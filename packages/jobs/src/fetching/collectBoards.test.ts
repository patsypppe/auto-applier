// Tests that collectBoards reads boards one at a time with a pause, keeps going after failures, and uses the cache.
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { readCachedBoard, writeCachedBoard } from "../storage/boardCache"
import type { BoardSource, JobRecord } from "../types"
import { collectAll, collectBoards } from "./collectBoards"

const NOW = new Date("2026-11-04T12:00:00Z")

// A made-up job site whose board answers are { titles: [...] } and whose jobs are one per title.
const fakeSite: BoardSource = {
  ats: "greenhouse",
  name: "Greenhouse",
  fetchRaw: (board, getJson) => getJson(`https://boards.example/${board.slug}`),
  readJobs: (raw, slug, seenAt) => {
    const titles = (raw as { titles?: string[] }).titles
    if (!titles) throw new Error(`Greenhouse board '${slug}' sent an answer without a jobs list.`)
    return titles.map((title, index) => jobNamed(slug, title, index, seenAt))
  },
}

// Builds a job record with only the details these tests look at; the company is the slug, as Lever and Ashby give it.
function jobNamed(slug: string, title: string, index: number, seenAt: string): JobRecord {
  return {
    key: `greenhouse:${slug}:${index}`,
    ats: "greenhouse",
    slug,
    company: slug,
    id: String(index),
    title,
    url: `https://boards.example/${slug}/${index}`,
    locations: [],
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    description: "",
  }
}

// Turns slugs into boards of the made-up site.
function boards(...slugs: string[]) {
  return slugs.map((slug) => ({ ats: "greenhouse" as const, slug }))
}

// Builds a fetch stand-in that answers each board URL from the given table, and 404 for anything else.
function fetchFrom(answers: Record<string, unknown>) {
  return vi.fn(async (url: string | URL | Request) => {
    const slug = String(url).split("/").pop()!
    const body = answers[slug]
    return body === undefined ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(body), { status: 200 })
  })
}

// Builds a sleep stand-in that returns at once and remembers the waits.
function fakeSleep() {
  return vi.fn(async (_ms: number) => undefined)
}

describe("collectBoards: reading boards", () => {
  test("reads each board in order and returns all their jobs", async () => {
    const fetchFn = fetchFrom({ acme: { titles: ["Data Analyst"] }, globex: { titles: ["ML Engineer", "SWE"] } })

    const { jobs, results } = await collectBoards(fakeSite, boards("acme", "globex"), { fetchFn, sleep: fakeSleep(), now: NOW })

    expect(jobs.map((job) => job.title)).toEqual(["Data Analyst", "ML Engineer", "SWE"])
    expect(results).toEqual([
      { ats: "greenhouse", slug: "acme", outcome: "fetched", jobs: 1 },
      { ats: "greenhouse", slug: "globex", outcome: "fetched", jobs: 2 },
    ])
  })

  test("waits the pause between requests but not before the first", async () => {
    const fetchFn = fetchFrom({ a: { titles: [] }, b: { titles: [] }, c: { titles: [] } })
    const sleep = fakeSleep()

    await collectBoards(fakeSite, boards("a", "b", "c"), { fetchFn, sleep, delayMs: 1000, now: NOW })

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 1000])
  })

  test("records a board that fails, with its status, and goes on with the next one", async () => {
    const fetchFn = fetchFrom({ globex: { titles: ["SWE"] } })

    const { jobs, results } = await collectBoards(fakeSite, boards("gone", "globex"), { fetchFn, sleep: fakeSleep(), now: NOW })

    expect(jobs.map((job) => job.slug)).toEqual(["globex"])
    expect(results[0]).toEqual({
      ats: "greenhouse",
      slug: "gone",
      outcome: "failed",
      jobs: 0,
      status: 404,
      error: "Greenhouse board 'gone' returned 404. It was not found, so the board may have moved or closed.",
    })
  })

  test("records an answer it cannot read as a failure", async () => {
    const fetchFn = fetchFrom({ odd: { something: "else" } })

    const { results } = await collectBoards(fakeSite, boards("odd"), { fetchFn, sleep: fakeSleep(), now: NOW })

    expect(results[0]).toMatchObject({ outcome: "failed", error: "Greenhouse board 'odd' sent an answer without a jobs list." })
  })

  test("names the company from the list when the board only gave its slug", async () => {
    const fetchFn = fetchFrom({ ramp: { titles: ["SWE"] } })

    const { jobs } = await collectBoards(fakeSite, [{ ats: "greenhouse", slug: "ramp", name: "Ramp" }], {
      fetchFn,
      sleep: fakeSleep(),
      now: NOW,
    })

    expect(jobs[0]!.company).toBe("Ramp")
  })

  test("reports each board as it finishes and each request as it goes out", async () => {
    const fetchFn = fetchFrom({ a: { titles: [] }, b: { titles: [] } })
    const onBoard = vi.fn()
    const onRequest = vi.fn()

    await collectBoards(fakeSite, boards("a", "b"), { fetchFn, sleep: fakeSleep(), now: NOW, onBoard, onRequest })

    expect(onBoard.mock.calls.map(([result, done, total]) => [result.slug, done, total])).toEqual([
      ["a", 1, 2],
      ["b", 2, 2],
    ])
    expect(onRequest.mock.calls.map(([url]) => url)).toEqual(["https://boards.example/a", "https://boards.example/b"])
  })
})

describe("collectBoards: the cache", () => {
  test("uses a fresh saved answer without asking the board or waiting", async () => {
    const dir = await mkdtemp(join(tmpdir(), "collect-"))
    await writeCachedBoard(dir, "greenhouse", "acme", { titles: ["Saved Job"] }, NOW)
    const fetchFn = fetchFrom({ globex: { titles: ["New Job"] } })
    const sleep = fakeSleep()

    const { jobs, results } = await collectBoards(fakeSite, boards("acme", "globex"), {
      fetchFn,
      sleep,
      delayMs: 1000,
      cache: { dir, maxAgeHours: 12 },
      now: NOW,
    })

    expect(jobs.map((job) => job.title)).toEqual(["Saved Job", "New Job"])
    expect(results.map((result) => result.outcome)).toEqual(["cached", "fetched"])
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  test("saves what it fetched for the next run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "collect-"))
    const fetchFn = fetchFrom({ acme: { titles: ["Fetched Job"] } })

    await collectBoards(fakeSite, boards("acme"), { fetchFn, sleep: fakeSleep(), cache: { dir, maxAgeHours: 12 }, now: NOW })

    expect(await readCachedBoard(dir, "greenhouse", "acme", 12, NOW)).toEqual({ titles: ["Fetched Job"] })
  })
})

describe("collectAll", () => {
  test("reads different job sites at the same time but each site one request at a time", async () => {
    const active: Record<string, number> = {}
    const most: Record<string, number> = {}
    let mostOverall = 0
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const host = new URL(String(url)).host
      active[host] = (active[host] ?? 0) + 1
      most[host] = Math.max(most[host] ?? 0, active[host]!)
      mostOverall = Math.max(mostOverall, Object.values(active).reduce((sum, count) => sum + count, 0))
      await new Promise((resolve) => setTimeout(resolve, 5))
      active[host]! -= 1
      return new Response(JSON.stringify(host.includes("lever") ? [] : { jobs: [] }), { status: 200 })
    })
    const list = [
      { ats: "greenhouse" as const, slug: "a" },
      { ats: "greenhouse" as const, slug: "b" },
      { ats: "lever" as const, slug: "c" },
      { ats: "lever" as const, slug: "d" },
      { ats: "ashby" as const, slug: "e" },
    ]

    const { results } = await collectAll(list, { fetchFn, sleep: fakeSleep(), now: NOW })

    expect(results.map((result) => `${result.ats}:${result.slug}:${result.outcome}`).sort()).toEqual([
      "ashby:e:fetched",
      "greenhouse:a:fetched",
      "greenhouse:b:fetched",
      "lever:c:fetched",
      "lever:d:fetched",
    ])
    expect(Object.values(most)).toEqual([1, 1, 1])
    expect(mostOverall).toBeGreaterThan(1)
  })
})

// Tests the local feed server: the page, the feed with hidden counts, hidden jobs on request, and saving statuses.
import type { Profile } from "@auto-applier/core"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { getJobs } from "../feed/getJobs"
import { parseSettings } from "../settings"
import type { JobRecord } from "../types"
import { serveFeed } from "./serveFeed"

const SETTINGS = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } })
const PROFILE: Profile = {
  personal: { firstName: "Sam", lastName: "Rivera", email: "sam@example.com", phone: "5550100", links: {} },
  experience: [],
  education: [],
  skills: ["Python"],
  answers: { workAuthorization: "F-1 OPT", needsSponsorship: true, isAuthorizedToWork: true },
}

// Builds a recent US job with the given details.
function job(id: string, details: Partial<JobRecord> = {}): JobRecord {
  return {
    key: `greenhouse:acme:${id}`,
    ats: "greenhouse",
    slug: "acme",
    company: "Acme",
    id,
    title: "Data Analyst",
    url: `https://boards.example/${id}`,
    locations: ["Austin, TX"],
    country: "US",
    postedAt: new Date().toISOString(),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    description: "Python and SQL.",
    ...details,
  }
}

let dataDir = ""
let server: { url: string; close: () => Promise<void> }

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "serve-data-"))
  const pageDir = await mkdtemp(join(tmpdir(), "serve-page-"))
  await writeFile(join(pageDir, "index.html"), "<!doctype html><title>Job feed</title>")
  await writeFile(join(pageDir, "page.js"), "console.info('page')")
  const ranked = getJobs(SETTINGS, PROFILE, [job("1"), job("2", { description: "U.S. citizenship required." }), job("3", { title: "Sales Lead" })])
  server = await serveFeed({ ranked, settings: SETTINGS, dataDir, pageDir, port: 0 })
})

afterEach(async () => {
  await server.close()
})

describe("serveFeed: what it serves", () => {
  test("listens only on this computer", () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  test("serves the page and its script", async () => {
    const page = await fetch(server.url)
    const script = await fetch(`${server.url}/page.js`)

    expect(page.headers.get("content-type")).toContain("text/html")
    expect(await page.text()).toContain("Job feed")
    expect(script.headers.get("content-type")).toContain("javascript")
  })

  test("answers 404 for anything else", async () => {
    expect((await fetch(`${server.url}/../secrets.txt`)).status).toBe(404)
  })
})

describe("serveFeed: the feed", () => {
  test("sends the shown jobs and how many were hidden for each reason", async () => {
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(feed.total).toBe(3)
    expect(feed.shown.map((card: { key: string }) => card.key)).toEqual(["greenhouse:acme:1"])
    expect(feed.hidden).toEqual([
      { reason: "blocked", count: 1 },
      { reason: "role", count: 1 },
    ])
    expect(feed.extra).toEqual([])
  })

  test("sends the hidden jobs for one reason when asked", async () => {
    const feed = await (await fetch(`${server.url}/api/feed?show=blocked`)).json()

    expect(feed.extra.map((card: { key: string; tags: { tag: string; evidence: string }[] }) => [card.key, card.tags[0]])).toEqual([
      ["greenhouse:acme:2", { tag: "citizen-only", evidence: "U.S. citizenship required.", context: "U.S. citizenship required." }],
    ])
  })

  test("applies the page's filter chips for that request only, and sends back the filters it used", async () => {
    const narrowed = await (await fetch(`${server.url}/api/feed?within=7&workplace=remote`)).json()
    const plain = await (await fetch(`${server.url}/api/feed`)).json()

    expect(narrowed.filters).toMatchObject({ postedWithinDays: 7, workplaces: ["remote"] })
    expect(plain.filters).toMatchObject({ postedWithinDays: 90, workplaces: [] })
  })

  test("refuses a filter chip it cannot use, saying what it takes", async () => {
    const answer = await fetch(`${server.url}/api/feed?workplace=office`)

    expect(answer.status).toBe(400)
    expect(await answer.json()).toEqual({ error: "workplace may only use remote, hybrid, onsite." })
  })

  test("leaves the long description out of each card", async () => {
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(feed.shown[0].description).toBeUndefined()
  })
})

describe("serveFeed: statuses", () => {
  // Sends a status change and returns the answer.
  function post(body: unknown) {
    return fetch(`${server.url}/api/applied`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  }

  test("saves a status to data/applied.json and sends it back with the feed", async () => {
    const answer = await post({ key: "greenhouse:acme:1", status: "applied", note: "Sent on Monday" })
    const saved = JSON.parse(await readFile(join(dataDir, "applied.json"), "utf8"))
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(answer.status).toBe(200)
    expect(saved[0]).toMatchObject({ key: "greenhouse:acme:1", title: "Data Analyst", status: "applied", note: "Sent on Monday" })
    expect(feed.applied[0].status).toBe("applied")
  })

  test("refuses a status it does not know, saying which ones it does", async () => {
    const answer = await post({ key: "greenhouse:acme:1", status: "ghosted" })

    expect(answer.status).toBe(400)
    expect((await answer.json()).error).toBe("status must be one of saved, applied, interviewing, offer, rejected, none.")
  })

  test("refuses a job it has never seen", async () => {
    const answer = await post({ key: "greenhouse:nobody:9", status: "applied" })

    expect(answer.status).toBe(404)
    expect((await answer.json()).error).toBe("No job with key greenhouse:nobody:9.")
  })

  test("still updates a job that is in the history but no longer listed", async () => {
    await writeFile(
      join(dataDir, "applied.json"),
      JSON.stringify([{ key: "greenhouse:gone:5", company: "Gone", title: "Analyst", url: "u", status: "applied", changes: [] }]),
    )

    expect((await post({ key: "greenhouse:gone:5", status: "rejected" })).status).toBe(200)
  })
})

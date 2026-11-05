// Tests the collect command end to end with a fake network: what it writes, and what it refuses to overwrite.
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { readJobsFile, writeJobsFile } from "../storage/files"
import type { JobRecord } from "../types"
import { runCollect } from "./collect"

const EARLIER: JobRecord = {
  key: "greenhouse:acme:1",
  ats: "greenhouse",
  slug: "acme",
  company: "Acme",
  id: "1",
  title: "Data Analyst",
  url: "https://boards.example/1",
  locations: ["Austin, TX"],
  country: "US",
  firstSeenAt: "2026-11-01T00:00:00.000Z",
  lastSeenAt: "2026-11-01T00:00:00.000Z",
  description: "Earlier feed",
}

// One Greenhouse job in the shape the board API sends.
const BOARD_ANSWER = {
  jobs: [{ id: 7, title: "ML Engineer", absolute_url: "https://boards.example/7", company_name: "Globex", location: { name: "Seattle, WA" }, content: "<p>Build models.</p>" }],
}

let dir = ""
const print = vi.fn()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "collect-command-"))
  print.mockClear()
  await writeFile(
    join(dir, "companies.json"),
    JSON.stringify(["acme", "globex", "initech"].map((slug) => ({ name: slug, ats: "greenhouse", slug, sources: ["test"] }))),
  )
  await writeJobsFile(join(dir, "jobs.jsonl"), [EARLIER])
})

// Builds a fetch stand-in that answers every board with one job.
function workingNetwork() {
  return vi.fn(async () => new Response(JSON.stringify(BOARD_ANSWER), { status: 200 }))
}

// Builds a fetch stand-in for a laptop with no connection.
function noNetwork() {
  return vi.fn(async () => {
    throw new TypeError("fetch failed")
  })
}

const quick = { sleep: async () => undefined }

describe("collect: a normal run", () => {
  test("replaces the feed with what the boards sent and logs each request", async () => {
    await runCollect(["--fresh"], dir, print, { ...quick, fetchFn: workingNetwork() })

    expect((await readJobsFile(join(dir, "jobs.jsonl"))).map((job) => job.title)).toEqual(["ML Engineer", "ML Engineer", "ML Engineer"])
    expect((await readFile(join(dir, "requests.log"), "utf8")).trim().split("\n")).toHaveLength(3)
  })
})

describe("collect: a run that must not replace the feed", () => {
  test("keeps the earlier feed when no board could be reached, and says so", async () => {
    await expect(runCollect(["--fresh"], dir, print, { ...quick, fetchFn: noNetwork() })).rejects.toThrow(
      "No board could be read, so the earlier feed was kept.",
    )

    expect((await readJobsFile(join(dir, "jobs.jsonl"))).map((job) => job.description)).toEqual(["Earlier feed"])
  })

  test("leaves no temporary files behind after refusing", async () => {
    await runCollect(["--fresh"], dir, print, { ...quick, fetchFn: noNetwork() }).catch(() => undefined)

    expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual([])
  })
})

describe("collect --board", () => {
  test("writes the chosen boards to their own file and leaves the full feed alone", async () => {
    await runCollect(["--board", "greenhouse:globex", "--fresh"], dir, print, { ...quick, fetchFn: workingNetwork() })

    expect((await readJobsFile(join(dir, "jobs.jsonl"))).map((job) => job.description)).toEqual(["Earlier feed"])
    expect((await readJobsFile(join(dir, "jobs.boards.jsonl"))).map((job) => job.company)).toEqual(["Globex"])
  })
})

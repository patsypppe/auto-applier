// Tests that the job and company files are written and read back, and that bad or missing files give clear messages.
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "vitest"
import type { JobRecord } from "../types"
import { readCompanyFile, readJobsFile, readJsonFile, writeJobsFile, writeJsonFile } from "./files"

let dir = ""

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "files-"))
})

const JOB: JobRecord = {
  key: "lever:spotify:1",
  ats: "lever",
  slug: "spotify",
  company: "Spotify",
  id: "1",
  title: "Data Scientist",
  url: "https://jobs.lever.co/spotify/1",
  locations: ["New York, NY"],
  country: "US",
  firstSeenAt: "2026-11-04T12:00:00.000Z",
  lastSeenAt: "2026-11-04T12:00:00.000Z",
  description: "Line one\nLine two",
}

describe("jobs file", () => {
  test("writes one job per line and reads them back", async () => {
    const file = join(dir, "jobs.jsonl")

    await writeJobsFile(file, [JOB, { ...JOB, key: "lever:spotify:2", id: "2" }])

    expect((await readFile(file, "utf8")).trim().split("\n")).toHaveLength(2)
    expect((await readJobsFile(file)).map((job) => job.id)).toEqual(["1", "2"])
  })

  test("replaces the file only once the new one is complete, leaving no temporary file", async () => {
    const file = join(dir, "jobs.jsonl")
    await writeJobsFile(file, [JOB])

    await writeJobsFile(file, [{ ...JOB, key: "lever:spotify:2", id: "2" }])

    expect((await readJobsFile(file)).map((job) => job.id)).toEqual(["2"])
    expect(await readdir(dir)).toEqual(["jobs.jsonl"])
  })

  test("keeps the earlier file whole when writing the new one fails halfway", async () => {
    const file = join(dir, "jobs.jsonl")
    await writeJobsFile(file, [JOB])
    const unwritable = { ...JOB, id: 3n } as unknown as JobRecord

    await expect(writeJobsFile(file, [{ ...JOB, id: "2" }, unwritable])).rejects.toThrow()

    expect((await readJobsFile(file)).map((job) => job.id)).toEqual(["1"])
  })

  test("reads a missing jobs file as no jobs", async () => {
    expect(await readJobsFile(join(dir, "nothing.jsonl"))).toEqual([])
  })
})

describe("plain JSON files", () => {
  test("writes a value and reads it back", async () => {
    const file = join(dir, "dead-boards.json")

    await writeJsonFile(file, { "lever:plaid": { first404: "2026-11-04", last404: "2026-11-04" } })

    expect(await readJsonFile(file, {})).toEqual({ "lever:plaid": { first404: "2026-11-04", last404: "2026-11-04" } })
  })

  test("returns the fallback when the file does not exist yet", async () => {
    expect(await readJsonFile(join(dir, "nothing.json"), { empty: true })).toEqual({ empty: true })
  })
})

describe("company file", () => {
  test("reads a list of companies", async () => {
    const file = join(dir, "companies.json")
    await writeFile(file, JSON.stringify([{ name: "Cirrus Logic", ats: "lever", slug: "cirrus", region: "eu", sources: ["x"] }]))

    expect(await readCompanyFile(file)).toEqual([
      { name: "Cirrus Logic", ats: "lever", slug: "cirrus", region: "eu", sources: ["x"] },
    ])
  })

  test("fills in the name and source of a hand-written entry", async () => {
    const file = join(dir, "companies.extra.json")
    await writeFile(file, JSON.stringify([{ ats: "ashby", slug: "openai" }]))

    expect(await readCompanyFile(file, { source: "extra" })).toEqual([
      { name: "openai", ats: "ashby", slug: "openai", sources: ["extra"] },
    ])
  })

  test("says which entry is wrong and why", async () => {
    const file = join(dir, "companies.extra.json")
    await writeFile(file, JSON.stringify([{ ats: "lever", slug: "ok" }, { ats: "workday", slug: "nvidia" }]))

    await expect(readCompanyFile(file)).rejects.toThrow(`${file} entry 2: ats must be one of greenhouse, lever, ashby.`)
  })

  test("says what to run when the list is missing", async () => {
    const file = join(dir, "companies.json")

    await expect(readCompanyFile(file)).rejects.toThrow(
      `No company list at ${file}. Run "npm run companies -w @auto-applier/jobs" first.`,
    )
  })

  test("reads a missing optional list as empty", async () => {
    expect(await readCompanyFile(join(dir, "companies.extra.json"), { optional: true })).toEqual([])
  })
})

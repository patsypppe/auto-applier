// Tests the h1b command: it saves the added-up history and reports how many collected companies it matched.
import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "vitest"
import { writeJobsFile } from "../storage/files"
import type { JobRecord } from "../types"
import { runH1b } from "./h1b"

// Builds a job at the given company, in the US unless told otherwise.
function job(company: string, country: JobRecord["country"] = "US"): JobRecord {
  return {
    key: `greenhouse:${company}:1`,
    ats: "greenhouse",
    slug: company.toLowerCase(),
    company,
    id: "1",
    title: "Data Analyst",
    url: "https://boards.example/1",
    locations: [],
    country,
    firstSeenAt: "2026-11-04T00:00:00.000Z",
    lastSeenAt: "2026-11-04T00:00:00.000Z",
    description: "",
  }
}

let dir = ""
const lines: string[] = []

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "h1b-command-"))
  lines.length = 0
  await copyFile(join(import.meta.dirname, "../../test/fixtures/uscis-h1b-sample.csv"), join(dir, "sample.csv"))
  await writeJobsFile(join(dir, "jobs.jsonl"), [job("Stripe"), job("OpenAI"), job("SpaceX"), job("Anduril Industries"), job("Abroad Co", "other")])
  await writeFile(join(dir, "aliases.json"), JSON.stringify({ SpaceX: "SPACE EXPLORATION TECHNOLOGIES CORP" }))
})

describe("h1b command", () => {
  test("saves the history and reports the match rate over companies with US jobs", async () => {
    await runH1b(["--file", join(dir, "sample.csv")], dir, (line) => lines.push(line))

    const saved = JSON.parse(await readFile(join(dir, "h1b.json"), "utf8"))
    expect(saved.employers.stripe.approvals).toBe(340)
    expect(lines).toContain("4 companies with US jobs: 3 matched (75%).")
    expect(lines).toContain("  alias: 1")
    expect(lines).toContain("  ambiguous: 0, no filings found: 1")
  })

  test("lists the companies it could not match, for writing aliases", async () => {
    await runH1b(["--file", join(dir, "sample.csv")], dir, (line) => lines.push(line))

    expect(await readFile(join(dir, "h1b-unmatched.txt"), "utf8")).toBe("Anduril Industries\tnone\n")
  })
})

// Tests the tags command: what it counts, the sample it writes for hand-checking, and how it reads the status.
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "vitest"
import { writeJobsFile } from "../storage/files"
import type { JobRecord } from "../types"
import { pickSample, readWorkAuthArgs, runTags } from "./tags"

// Builds a job with the given text and country.
function job(id: string, description: string, country: JobRecord["country"] = "US"): JobRecord {
  return {
    key: `greenhouse:acme:${id}`,
    ats: "greenhouse",
    slug: "acme",
    company: "Acme",
    id,
    title: "Data Analyst",
    url: `https://boards.example/${id}`,
    locations: ["Austin, TX"],
    country,
    firstSeenAt: "2026-11-04T00:00:00.000Z",
    lastSeenAt: "2026-11-04T00:00:00.000Z",
    description,
  }
}

let dir = ""
const lines: string[] = []
const print = (line: string) => lines.push(line)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "tags-command-"))
  lines.length = 0
  await writeJobsFile(join(dir, "jobs.jsonl"), [
    job("1", "We are unable to sponsor visas."),
    job("2", "U.S. citizenship required."),
    job("3", "Build dashboards in SQL."),
    job("4", "We are unable to sponsor visas.", "other"),
  ])
})

describe("tags command", () => {
  test("counts tags over jobs that are not abroad, and what they mean for the chosen status", async () => {
    await runTags(["--status", "f1-opt"], dir, print)

    const output = lines.join("\n")
    expect(output).toContain("3 jobs in the US or with no country")
    expect(output).toContain("no-sponsorship  1")
    expect(output).toContain("citizen-only  1")
    expect(output).toContain("not-stated  1")
    expect(output).toContain("For f1-opt: blocked 1, likely-blocked 1, ok 1, positive 0")
  })

  test("writes a sample for hand-checking with each tag's evidence and the job's link", async () => {
    await runTags([], dir, print)

    const sample = JSON.parse(await readFile(join(dir, "tag-check.json"), "utf8"))
    expect(sample.withTags.map((entry: { url: string }) => entry.url).sort()).toEqual([
      "https://boards.example/1",
      "https://boards.example/2",
    ])
    expect(sample.withTags.find((entry: { url: string }) => entry.url.endsWith("/1")).tags).toEqual([
      { tag: "no-sponsorship", evidence: "We are unable to sponsor visas." },
    ])
    expect(sample.random).toHaveLength(3)
  })
})

describe("readWorkAuthArgs", () => {
  test("defaults to an OPT student with a STEM degree who will need sponsorship later", () => {
    expect(readWorkAuthArgs([])).toEqual({ status: "f1-opt", needsSponsorshipLater: true, stemDegree: true, clearance: "none" })
  })

  test("reads the status, and a citizen gets no later sponsorship and a clearance they can obtain", () => {
    expect(readWorkAuthArgs(["--status", "citizen"])).toEqual({
      status: "citizen",
      needsSponsorshipLater: false,
      stemDegree: true,
      clearance: "can-obtain",
    })
  })

  test("refuses a status it does not know, listing the ones it does", () => {
    expect(() => readWorkAuthArgs(["--status", "tourist"])).toThrow(
      "Unknown status 'tourist'. Use one of: citizen, permanent-resident, f1-cpt, f1-opt, f1-stem-opt, h1b, other-needs-sponsorship.",
    )
  })
})

describe("pickSample", () => {
  test("picks the same items every time for the same list", () => {
    const items = Array.from({ length: 100 }, (_, i) => i)

    expect(pickSample(items, 5)).toEqual(pickSample(items, 5))
    expect(new Set(pickSample(items, 5)).size).toBe(5)
  })

  test("returns everything when the list is shorter than the sample", () => {
    expect(pickSample([1, 2], 5).sort()).toEqual([1, 2])
  })
})

// Tests the top command: it prints the best jobs with their reasons, and says how many were hidden and why.
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "vitest"
import { writeJobsFile } from "../storage/files"
import type { JobRecord } from "../types"
import { runTop } from "./top"

// Builds a US job posted recently, with the given details.
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
    postedAt: new Date(Date.now() - 86_400_000).toISOString(),
    firstSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
    lastSeenAt: new Date().toISOString(),
    description: "Python and SQL.",
    ...details,
  }
}

let dir = ""
const lines: string[] = []
const print = (line: string) => lines.push(line)

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "top-command-"))
  lines.length = 0
  await writeFile(join(dir, "settings.json"), JSON.stringify({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } }))
  await writeFile(
    join(dir, "profile.json"),
    JSON.stringify({
      personal: { firstName: "Sam", lastName: "Rivera", email: "sam@example.com", phone: "5550100", links: {} },
      experience: [],
      education: [],
      skills: ["Python"],
      answers: { workAuthorization: "F-1 OPT", needsSponsorship: true, isAuthorizedToWork: true },
    }),
  )
  await writeJobsFile(join(dir, "jobs.jsonl"), [
    job("1", { description: "Python and SQL. We are unable to sponsor visas." }),
    job("2", { description: "U.S. citizenship required." }),
    job("3", { title: "Account Executive" }),
  ])
})

describe("top command", () => {
  test("says how many jobs are shown and why the others were hidden", async () => {
    await runTop([], dir, print)

    expect(lines[0]).toBe("Showing 1 of 3 jobs. Hidden: blocked 1, role 1.")
  })

  test("prints each shown job with its score, skills, work-authorization evidence and link", async () => {
    await runTop([], dir, print)

    const output = lines.join("\n")
    expect(output).toContain("1. 53  Data Analyst at Acme (Austin, TX)")
    expect(output).toContain("you have: Python | missing: SQL")
    expect(output).toContain("likely blocked: no-sponsorship: We are unable to sponsor visas.")
    expect(output).toContain("https://boards.example/1")
  })

  test("prints at most the number asked for with --limit", async () => {
    await writeJobsFile(join(dir, "jobs.jsonl"), [job("a"), job("b"), job("c")])

    await runTop(["--limit", "2"], dir, print)

    expect(lines.filter((line) => /^\s*\d+\. /.test(line))).toHaveLength(2)
  })
})

// Tests that prepareJobsFile prepares the jobs in data/jobs.jsonl one at a time, in file order, without their descriptions.
import type { Profile } from "@auto-applier/core"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { writeJobsFile } from "../storage/files"
import type { JobRecord } from "../types"
import { prepareJobsFile } from "./prepareJobsFile"

const PROFILE: Profile = {
  personal: { firstName: "Sam", lastName: "Rivera", email: "sam@example.com", phone: "5550100", links: {} },
  experience: [],
  education: [],
  skills: ["Python"],
  answers: { workAuthorization: "F-1 OPT", needsSponsorship: true, isAuthorizedToWork: true },
}

// Builds a job with the given id and description.
function job(id: string, description: string): JobRecord {
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
    firstSeenAt: "2026-11-03T00:00:00Z",
    lastSeenAt: "2026-11-04T00:00:00Z",
    description,
  }
}

describe("prepareJobsFile", () => {
  test("prepares every job in file order and drops the descriptions", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "prepare-")), "jobs.jsonl")
    await writeJobsFile(file, [job("1", "Python. Pay: $90,000 - $110,000 a year."), job("2", "U.S. citizenship required.")])

    const prepared = await prepareJobsFile(file, PROFILE)

    expect(prepared.map(({ job: entry }) => entry.id)).toEqual(["1", "2"])
    expect(prepared.every(({ job: entry }) => !("description" in entry))).toBe(true)
    expect(prepared[0]!.reads.matchedSkills).toEqual(["Python"])
    expect(prepared[0]!.pay).toMatchObject({ min: 90000, max: 110000 })
    expect(prepared[1]!.tags.map(({ tag }) => tag)).toEqual(["citizen-only"])
  })

  test("gives no jobs when the file does not exist yet", async () => {
    expect(await prepareJobsFile(join(tmpdir(), "no-such-folder", "jobs.jsonl"), PROFILE)).toEqual([])
  })
})

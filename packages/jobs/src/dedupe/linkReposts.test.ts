// Tests that linkReposts keeps first-seen dates across runs, links a posting reposted under a new id, and forgets old ones.
import { describe, expect, test } from "vitest"
import type { JobRecord } from "../types"
import { linkReposts, type SeenJobs } from "./linkReposts"

const TODAY = new Date("2026-11-04T12:00:00Z")

// Builds a job as this run collected it, seen for the first time today.
function job(key: string, textHash: string): JobRecord {
  return {
    key,
    ats: "greenhouse",
    slug: "acme",
    company: "Acme",
    id: key.split(":")[2]!,
    title: "Data Analyst",
    url: `https://boards.example/${key}`,
    locations: ["Austin, TX"],
    country: "US",
    firstSeenAt: TODAY.toISOString(),
    lastSeenAt: TODAY.toISOString(),
    description: "",
    textHash,
  }
}

describe("linkReposts", () => {
  test("keeps the first-seen date of a job seen in an earlier run", () => {
    const seen: SeenJobs = { "greenhouse:acme:1": { textHash: "h1", firstSeenAt: "2026-10-01T00:00:00Z", lastSeenAt: "2026-11-03T00:00:00Z" } }

    const { jobs } = linkReposts([job("greenhouse:acme:1", "h1")], seen, TODAY)

    expect(jobs[0]!.firstSeenAt).toBe("2026-10-01T00:00:00Z")
    expect(jobs[0]!.repostOf).toBeUndefined()
  })

  test("links a posting reposted under a new id to the earlier one", () => {
    const seen: SeenJobs = { "greenhouse:acme:1": { textHash: "h1", firstSeenAt: "2026-10-01T00:00:00Z", lastSeenAt: "2026-10-20T00:00:00Z" } }

    const { jobs } = linkReposts([job("greenhouse:acme:2", "h1")], seen, TODAY)

    expect(jobs[0]).toMatchObject({ repostOf: "greenhouse:acme:1", firstSeenAt: "2026-10-01T00:00:00Z" })
  })

  test("keeps pointing at the oldest copy when a repost is reposted again", () => {
    const seen: SeenJobs = {
      "greenhouse:acme:1": { textHash: "h1", firstSeenAt: "2026-09-01T00:00:00Z", lastSeenAt: "2026-09-20T00:00:00Z" },
      "greenhouse:acme:2": { textHash: "h1", firstSeenAt: "2026-09-01T00:00:00Z", lastSeenAt: "2026-10-20T00:00:00Z", repostOf: "greenhouse:acme:1" },
    }

    const { jobs } = linkReposts([job("greenhouse:acme:3", "h1")], seen, TODAY)

    expect(jobs[0]!.repostOf).toBe("greenhouse:acme:1")
  })

  test("does not link to a posting last seen more than 60 days ago", () => {
    const seen: SeenJobs = { "greenhouse:acme:1": { textHash: "h1", firstSeenAt: "2026-06-01T00:00:00Z", lastSeenAt: "2026-08-01T00:00:00Z" } }

    const { jobs } = linkReposts([job("greenhouse:acme:2", "h1")], seen, TODAY)

    expect(jobs[0]!.repostOf).toBeUndefined()
    expect(jobs[0]!.firstSeenAt).toBe(TODAY.toISOString())
  })

  test("remembers this run's jobs and forgets ones not seen for 60 days", () => {
    const seen: SeenJobs = {
      "greenhouse:acme:old": { textHash: "h0", firstSeenAt: "2026-06-01T00:00:00Z", lastSeenAt: "2026-08-01T00:00:00Z" },
      "greenhouse:acme:recent": { textHash: "h9", firstSeenAt: "2026-10-01T00:00:00Z", lastSeenAt: "2026-10-30T00:00:00Z" },
    }

    const { seen: next } = linkReposts([job("greenhouse:acme:1", "h1")], seen, TODAY)

    expect(Object.keys(next).sort()).toEqual(["greenhouse:acme:1", "greenhouse:acme:recent"])
    expect(next["greenhouse:acme:1"]).toEqual({ textHash: "h1", firstSeenAt: TODAY.toISOString(), lastSeenAt: TODAY.toISOString() })
  })
})

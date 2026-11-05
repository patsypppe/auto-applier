// Tests that joinAcrossBoards folds the same posting listed on two of a company's boards into one job, and nothing else.
import { describe, expect, test } from "vitest"
import type { JobRecord } from "../types"
import { joinAcrossBoards } from "./joinAcrossBoards"

const LONG_TEXT = "Join our data team for the summer. ".repeat(12)

// Builds a job on the given board with the given id and details.
function job(slug: string, id: string, details: Partial<JobRecord> = {}): JobRecord {
  return {
    key: `greenhouse:${slug}:${id}`,
    ats: "greenhouse",
    slug,
    company: slug,
    id,
    title: "(SUMMER) Data Analyst Intern",
    url: `https://boards.example/${slug}/${id}`,
    locations: ["Austin, Texas"],
    country: "US",
    firstSeenAt: "2026-11-04T00:00:00.000Z",
    lastSeenAt: "2026-11-04T00:00:00.000Z",
    description: LONG_TEXT,
    ...details,
  }
}

describe("joinAcrossBoards", () => {
  test("folds the same posting on a second board into the first board's job, keeping both links", () => {
    const jobs = joinAcrossBoards([job("integrafec", "1"), job("integrafecinternships", "9")])

    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.key).toBe("greenhouse:integrafec:1")
    expect(jobs[0]!.copies).toEqual([
      { id: "1", url: "https://boards.example/integrafec/1", locations: ["Austin, Texas"] },
      { id: "9", url: "https://boards.example/integrafecinternships/9", locations: ["Austin, Texas"] },
    ])
  })

  test("picks the same job to keep whatever order the boards came in", () => {
    expect(joinAcrossBoards([job("integrafecinternships", "9"), job("integrafec", "1")])[0]!.key).toBe("greenhouse:integrafec:1")
  })

  test("keeps postings apart when their text differs", () => {
    expect(joinAcrossBoards([job("a", "1"), job("b", "2", { description: `${LONG_TEXT} Pay is $30 an hour.` })])).toHaveLength(2)
  })

  test("keeps postings apart when they are listed at different places", () => {
    expect(joinAcrossBoards([job("a", "1"), job("b", "2", { locations: ["Chicago, IL"] })])).toHaveLength(2)
  })

  test("leaves two same-text openings on one board alone", () => {
    expect(joinAcrossBoards([job("a", "1"), job("a", "2")])).toHaveLength(2)
  })

  test("leaves short postings alone, since a few generic lines can match by chance", () => {
    expect(joinAcrossBoards([job("a", "1", { description: "Apply now." }), job("b", "2", { description: "Apply now." })])).toHaveLength(2)
  })

  test("keeps the copies a job already had from its own board", () => {
    const earlier = job("a", "1", { copies: [{ id: "1", url: "u1", locations: ["Austin, Texas"] }, { id: "3", url: "u3", locations: ["Dallas, TX"] }], locations: ["Austin, Texas", "Dallas, TX"] })
    const other = job("b", "2", { locations: ["Austin, Texas", "Dallas, TX"] })

    expect(joinAcrossBoards([earlier, other])[0]!.copies!.map((copy) => copy.id)).toEqual(["1", "3", "2"])
  })
})

// Tests that the Lever source asks for the right board and reads saved Lever postings into job records.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { lever } from "./lever"

const POSTINGS = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/lever-spotify.json"), "utf8"))
const SEEN_AT = "2026-11-04T12:00:00.000Z"

describe("lever: the request", () => {
  test("asks for the board's postings as JSON", async () => {
    const getJson = vi.fn(async (_url: string) => [])

    await lever.fetchRaw("spotify", getJson)

    expect(getJson).toHaveBeenCalledWith("https://api.lever.co/v0/postings/spotify?mode=json")
  })
})

describe("lever: reading postings", () => {
  test("turns a posting into a record", () => {
    const [job] = lever.readJobs(POSTINGS, "spotify", SEEN_AT)

    const { description, ...rest } = job!
    expect(rest).toEqual({
      key: "lever:spotify:2a55d6c9-c564-443a-be3e-a3851db5a93b",
      ats: "lever",
      slug: "spotify",
      company: "spotify",
      id: "2a55d6c9-c564-443a-be3e-a3851db5a93b",
      title: "Account Executive - Commercial, Spotify Technology",
      url: "https://jobs.lever.co/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b",
      locations: ["New York, NY"],
      country: "US",
      postedAt: new Date(1792767640768).toISOString(),
      firstSeenAt: SEEN_AT,
      lastSeenAt: SEEN_AT,
    })
    expect(description.length).toBeGreaterThan(500)
  })

  test("takes the country from Lever's country code", () => {
    const jobs = lever.readJobs(POSTINGS, "spotify", SEEN_AT)

    expect(jobs.map((job) => [job.locations, job.country])).toEqual([
      [["New York, NY"], "US"],
      [["London"], "other"],
      [["Singapore"], "other"],
    ])
  })

  test("reads a Canadian code as another country, not as California", () => {
    const posting = { ...POSTINGS[0], country: "CA", categories: { location: "Toronto, CA" } }

    const [job] = lever.readJobs([posting], "spotify", SEEN_AT)

    expect(job!.country).toBe("other")
    expect(job!.locations).toEqual(["Toronto, CA"])
  })

  test("puts the opening, every list and the closing text into the description", () => {
    const [job] = lever.readJobs(POSTINGS, "spotify", SEEN_AT)

    const description = job!.description
    expect(description).toContain("What You'll Do")
    expect(description).toContain("Who You Are")
    expect(description).toContain("The United States base range for this position is $87,069-$124,385 plus equity.")
    expect(description).not.toMatch(/<li>|<div>/)
  })

  test("skips a posting with no id or title and keeps the rest", () => {
    const broken = { ...POSTINGS[0], text: "  " }

    const jobs = lever.readJobs([broken, POSTINGS[1]], "spotify", SEEN_AT)

    expect(jobs.map((job) => job.id)).toEqual(["2d67c471-9015-41c0-a041-b982ec4a14fd"])
  })

  test("refuses an answer that is not a list of postings", () => {
    expect(() => lever.readJobs({ ok: false, error: "Document not found" }, "plaid", SEEN_AT)).toThrow(
      "Lever board 'plaid' sent an answer without a postings list.",
    )
  })
})

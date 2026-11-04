// Tests that the Ashby source asks for the right board and reads saved Ashby jobs into job records.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { ashby } from "./ashby"

const BOARD = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/ashby-ramp.json"), "utf8"))
const SEEN_AT = "2026-11-04T12:00:00.000Z"

describe("ashby: the request", () => {
  test("asks for the job board by name", async () => {
    const getJson = vi.fn(async (_url: string) => ({ jobs: [] }))

    await ashby.fetchRaw("ramp", getJson)

    expect(getJson).toHaveBeenCalledWith("https://api.ashbyhq.com/posting-api/job-board/ramp")
  })
})

describe("ashby: reading jobs", () => {
  test("turns a job into a record, with every location", () => {
    const [job] = ashby.readJobs(BOARD, "ramp", SEEN_AT)

    const { description, ...rest } = job!
    expect(rest).toEqual({
      key: "ashby:ramp:34413f8d-26bf-4bbc-8ade-eb309a0e2245",
      ats: "ashby",
      slug: "ramp",
      company: "ramp",
      id: "34413f8d-26bf-4bbc-8ade-eb309a0e2245",
      title: "Security Engineer, Cloud",
      url: "https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245",
      locations: ["New York, NY (HQ)", "Remote (Canada)", "Remote (US)", "Miami, FL"],
      country: "US",
      postedAt: "2026-04-07T17:12:35.753+00:00",
      firstSeenAt: SEEN_AT,
      lastSeenAt: SEEN_AT,
    })
    expect(description.length).toBeGreaterThan(500)
  })

  test("reads the country from the address when the location text does not say", () => {
    const jobs = ashby.readJobs(BOARD, "ramp", SEEN_AT)

    expect(jobs.map((job) => [job.locations, job.country])).toEqual([
      [["New York, NY (HQ)", "Remote (Canada)", "Remote (US)", "Miami, FL"], "US"],
      [["London, UK"], "other"],
      [["Toronto, ON"], "other"],
    ])
  })

  test("leaves out jobs the company has unlisted", () => {
    const hidden = { ...BOARD.jobs[0], isListed: false }

    const jobs = ashby.readJobs({ jobs: [hidden, BOARD.jobs[1]] }, "ramp", SEEN_AT)

    expect(jobs.map((job) => job.id)).toEqual(["1515fe6d-1d8e-475b-a5ee-cefe43e78cb7"])
  })

  test("falls back to the HTML description when there is no plain one", () => {
    const job = { ...BOARD.jobs[1], descriptionPlain: null, descriptionHtml: "<p>Sell <b>Ramp</b>.</p>" }

    const [record] = ashby.readJobs({ jobs: [job] }, "ramp", SEEN_AT)

    expect(record!.description).toBe("Sell Ramp.")
  })

  test("refuses an answer without a jobs list", () => {
    expect(() => ashby.readJobs({ error: "not found" }, "nobody", SEEN_AT)).toThrow(
      "Ashby board 'nobody' sent an answer without a jobs list.",
    )
  })
})

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

    await ashby.fetchRaw({ slug: "ramp" }, getJson)

    expect(getJson).toHaveBeenCalledWith("https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true")
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
      pay: { min: 211400, max: 290600, currency: "USD", per: "year", from: "board" },
      jobType: "full-time",
      workplace: "hybrid",
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

  test("reads the salary from the board, in its own currency, and leaves pay out when the board gives none", () => {
    const jobs = ashby.readJobs(BOARD, "ramp", SEEN_AT)

    expect(jobs.map((job) => job.pay)).toEqual([
      { min: 211400, max: 290600, currency: "USD", per: "year", from: "board" },
      undefined,
      { min: 166600, max: 182000, currency: "CAD", per: "year", from: "board" },
    ])
  })

  test("reads an hourly salary as pay per hour", () => {
    const hourly = { compensationTiers: [{ components: [{ compensationType: "Salary", interval: "1 HOUR", currencyCode: "USD", minValue: 40, maxValue: 55 }] }] }

    const [job] = ashby.readJobs({ jobs: [{ ...BOARD.jobs[0], compensation: hourly }] }, "ramp", SEEN_AT)

    expect(job!.pay).toEqual({ min: 40, max: 55, currency: "USD", per: "hour", from: "board" })
  })

  test.each([
    ["FullTime", "full-time"],
    ["PartTime", "part-time"],
    ["Contract", "contract"],
    ["Intern", "intern"],
    ["Temporary", "temporary"],
  ])("reads the employment type %s as %s", (employmentType, jobType) => {
    const [job] = ashby.readJobs({ jobs: [{ ...BOARD.jobs[0], employmentType }] }, "ramp", SEEN_AT)

    expect(job!.jobType).toBe(jobType)
  })

  test.each([
    ["OnSite", "onsite"],
    ["Hybrid", "hybrid"],
    ["Remote", "remote"],
    [null, undefined],
  ])("reads the workplace %s as %s", (workplaceType, workplace) => {
    const [job] = ashby.readJobs({ jobs: [{ ...BOARD.jobs[0], workplaceType }] }, "ramp", SEEN_AT)

    expect(job!.workplace).toBe(workplace)
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

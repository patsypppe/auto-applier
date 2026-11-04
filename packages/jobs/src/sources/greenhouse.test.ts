// Tests that the Greenhouse source asks for the right board and reads a saved Greenhouse board into job records.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { greenhouse } from "./greenhouse"

const BOARD = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/greenhouse-databricks.json"), "utf8"))
const SEEN_AT = "2026-11-04T12:00:00.000Z"

describe("greenhouse: the request", () => {
  test("asks for the board's jobs with their descriptions", async () => {
    const getJson = vi.fn(async (_url: string) => ({ jobs: [] }))

    await greenhouse.fetchRaw("databricks", getJson)

    expect(getJson).toHaveBeenCalledWith("https://boards-api.greenhouse.io/v1/boards/databricks/jobs?content=true")
  })

  test("encodes odd characters in the slug", async () => {
    const getJson = vi.fn(async (_url: string) => ({ jobs: [] }))

    await greenhouse.fetchRaw("a b/c", getJson)

    expect(getJson).toHaveBeenCalledWith("https://boards-api.greenhouse.io/v1/boards/a%20b%2Fc/jobs?content=true")
  })
})

describe("greenhouse: reading jobs", () => {
  test("turns a job into a record", () => {
    const jobs = greenhouse.readJobs(BOARD, "databricks", SEEN_AT)

    const { description, ...rest } = jobs[0]!
    expect(rest).toEqual({
      key: "greenhouse:databricks:8788190002",
      ats: "greenhouse",
      slug: "databricks",
      company: "Databricks",
      id: "8788190002",
      title: "Chief of Staff to the CMO",
      url: "https://databricks.com/company/careers/open-positions/job?gh_jid=8788190002",
      locations: ["San Francisco, California"],
      country: "US",
      postedAt: "2026-09-30T20:26:35-04:00",
      updatedAt: "2026-10-06T07:03:51-04:00",
      firstSeenAt: SEEN_AT,
      lastSeenAt: SEEN_AT,
    })
    expect(description.length).toBeGreaterThan(1000)
  })

  test("keeps every job on the board", () => {
    const jobs = greenhouse.readJobs(BOARD, "databricks", SEEN_AT)

    expect(jobs.map((job) => job.id)).toEqual(["8788190002", "8805655002", "6918763002", "8760167002"])
  })

  test("splits locations joined with semicolons and reads the country from them", () => {
    const jobs = greenhouse.readJobs(BOARD, "databricks", SEEN_AT)

    expect(jobs.map((job) => [job.locations, job.country])).toEqual([
      [["San Francisco, California"], "US"],
      [["Tokyo, Japan"], "other"],
      [["Bengaluru, India", "Mumbai, India"], "other"],
      [["Maryland", "Virginia", "Washington, D.C."], "US"],
    ])
  })

  test("reads the country from the job's offices when the location is only a city", () => {
    const dublin = { ...BOARD.jobs[0], location: { name: "Dublin" }, offices: [{ name: "Ireland Locations", location: null }] }
    const chicago = { ...BOARD.jobs[1], location: { name: "Chicago" }, offices: [{ name: "US", location: null }] }
    const london = { ...BOARD.jobs[2], location: { name: "London" }, offices: [{ name: "GB-London", location: "London, England, United Kingdom" }] }

    const jobs = greenhouse.readJobs({ jobs: [dublin, chicago, london] }, "databricks", SEEN_AT)

    expect(jobs.map((job) => [job.locations, job.country])).toEqual([
      [["Dublin"], "other"],
      [["Chicago"], "US"],
      [["London"], "other"],
    ])
  })

  test("trims spaces around the title", () => {
    const jobs = greenhouse.readJobs(BOARD, "databricks", SEEN_AT)

    expect(jobs[2]!.title).toBe("Account Executive")
  })

  test("stores the description as plain text", () => {
    const jobs = greenhouse.readJobs(BOARD, "databricks", SEEN_AT)

    const description = jobs[3]!.description
    expect(description).toContain("U.S. citizenship and eligibility for a U.S. government")
    expect(description).not.toMatch(/<|&lt;|&amp;/)
  })

  test("uses the slug as the company name when the job has none", () => {
    const job = { ...BOARD.jobs[0], company_name: null }

    const jobs = greenhouse.readJobs({ jobs: [job] }, "acme", SEEN_AT)

    expect(jobs[0]!.company).toBe("acme")
  })
})

describe("greenhouse: answers it cannot use", () => {
  test("refuses an answer without a jobs list", () => {
    expect(() => greenhouse.readJobs({ error: "nope" }, "acme", SEEN_AT)).toThrow(
      "Greenhouse board 'acme' sent an answer without a jobs list.",
    )
  })

  test("skips a job with no id or title and keeps the rest", () => {
    const broken = { ...BOARD.jobs[0], id: null }

    const jobs = greenhouse.readJobs({ jobs: [broken, BOARD.jobs[1]] }, "databricks", SEEN_AT)

    expect(jobs.map((job) => job.id)).toEqual(["8805655002"])
  })
})

// Tests that fetchGreenhouseBoard reads a saved Greenhouse board into job records and refuses answers it cannot use.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { fetchGreenhouseBoard } from "./greenhouse"

const BOARD = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/greenhouse-databricks.json"), "utf8"))
const NOW = new Date("2026-11-04T12:00:00Z")

// Builds a fetch stand-in that answers every request with the given body and status.
function fetchAnswering(body: unknown, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))
}

// Reads the board through a fetch stand-in, with no real waiting.
function readBoard(fetchFn: typeof fetch, slug = "databricks") {
  return fetchGreenhouseBoard(slug, { fetchFn, sleep: async () => undefined, now: NOW })
}

describe("fetchGreenhouseBoard: the request", () => {
  test("asks for the board's jobs with their descriptions", async () => {
    const fetchFn = fetchAnswering(BOARD)

    await readBoard(fetchFn)

    expect(fetchFn.mock.calls[0]![0]).toBe("https://boards-api.greenhouse.io/v1/boards/databricks/jobs?content=true")
  })

  test("encodes odd characters in the slug", async () => {
    const fetchFn = fetchAnswering({ jobs: [] })

    await readBoard(fetchFn, "a b/c")

    expect(fetchFn.mock.calls[0]![0]).toBe("https://boards-api.greenhouse.io/v1/boards/a%20b%2Fc/jobs?content=true")
  })
})

describe("fetchGreenhouseBoard: reading jobs", () => {
  test("turns a job into a record", async () => {
    const jobs = await readBoard(fetchAnswering(BOARD))

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
      firstSeenAt: "2026-11-04T12:00:00.000Z",
      lastSeenAt: "2026-11-04T12:00:00.000Z",
    })
    expect(description.length).toBeGreaterThan(1000)
  })

  test("keeps every job on the board", async () => {
    const jobs = await readBoard(fetchAnswering(BOARD))

    expect(jobs.map((job) => job.id)).toEqual(["8788190002", "8805655002", "6918763002", "8760167002"])
  })

  test("splits locations joined with semicolons and reads the country from them", async () => {
    const jobs = await readBoard(fetchAnswering(BOARD))

    expect(jobs.map((job) => [job.locations, job.country])).toEqual([
      [["San Francisco, California"], "US"],
      [["Tokyo, Japan"], "other"],
      [["Bengaluru, India", "Mumbai, India"], "other"],
      [["Maryland", "Virginia", "Washington, D.C."], "US"],
    ])
  })

  test("reads the country from the job's offices when the location is only a city", async () => {
    const dublin = { ...BOARD.jobs[0], location: { name: "Dublin" }, offices: [{ name: "Ireland Locations", location: null }] }
    const chicago = { ...BOARD.jobs[1], location: { name: "Chicago" }, offices: [{ name: "US", location: null }] }
    const london = { ...BOARD.jobs[2], location: { name: "London" }, offices: [{ name: "GB-London", location: "London, England, United Kingdom" }] }

    const jobs = await readBoard(fetchAnswering({ jobs: [dublin, chicago, london] }))

    expect(jobs.map((job) => [job.locations, job.country])).toEqual([
      [["Dublin"], "other"],
      [["Chicago"], "US"],
      [["London"], "other"],
    ])
  })

  test("trims spaces around the title", async () => {
    const jobs = await readBoard(fetchAnswering(BOARD))

    expect(jobs[2]!.title).toBe("Account Executive")
  })

  test("stores the description as plain text", async () => {
    const jobs = await readBoard(fetchAnswering(BOARD))

    const description = jobs[3]!.description
    expect(description).toContain("U.S. citizenship and eligibility for a U.S. government")
    expect(description).not.toMatch(/<|&lt;|&amp;/)
  })

  test("uses the slug as the company name when the job has none", async () => {
    const job = { ...BOARD.jobs[0], company_name: null }

    const jobs = await readBoard(fetchAnswering({ jobs: [job] }), "acme")

    expect(jobs[0]!.company).toBe("acme")
  })
})

describe("fetchGreenhouseBoard: answers it cannot use", () => {
  test("refuses an answer without a jobs list", async () => {
    await expect(readBoard(fetchAnswering({ error: "nope" }), "acme")).rejects.toThrow(
      "Greenhouse board 'acme' sent an answer without a jobs list.",
    )
  })

  test("skips a job with no id or title and keeps the rest", async () => {
    const broken = { ...BOARD.jobs[0], id: null }

    const jobs = await readBoard(fetchAnswering({ jobs: [broken, BOARD.jobs[1]] }))

    expect(jobs.map((job) => job.id)).toEqual(["8805655002"])
  })

  test("passes on the reason when the board is not found", async () => {
    await expect(readBoard(fetchAnswering({}, 404), "acme")).rejects.toThrow("Greenhouse board 'acme' returned 404.")
  })
})

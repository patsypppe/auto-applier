// Tests that the Workday source searches a board for each wanted role, fetches details only for jobs whose title fits,
// and reads saved Workday answers into job records.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { workday } from "./workday"

const SAVED = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/workday-adobe.json"), "utf8"))
const BOARD = { slug: "adobe|wd5|external_experienced" }
const BASE = "https://adobe.wd5.myworkdayjobs.com/wday/cxs/adobe/external_experienced"
const SEEN_AT = "2026-11-04T12:00:00.000Z"

// Builds a request stand-in that answers the search pages and job details from the saved answers.
function savedBoard() {
  return vi.fn(async (url: string, body?: unknown) => {
    if (url === `${BASE}/jobs`) return (body as { offset: number }).offset === 0 ? SAVED.pages[0] : SAVED.pages[1]
    const path = url.slice(BASE.length)
    return SAVED.details[path] ?? { error: "not saved" }
  })
}

describe("workday: the requests", () => {
  test("searches the board for each role, 20 jobs a page, until the first page's total is reached", async () => {
    const getJson = savedBoard()

    await workday.fetchRaw(BOARD, getJson, { roles: ["data scientist"] })

    const searches = getJson.mock.calls.filter(([url]) => url === `${BASE}/jobs`).map(([, body]) => body)
    expect(searches).toEqual([
      { appliedFacets: {}, limit: 20, offset: 0, searchText: "data scientist" },
      { appliedFacets: {}, limit: 20, offset: 20, searchText: "data scientist" },
    ])
  })

  test("fetches details only for jobs whose title holds a wanted role", async () => {
    const getJson = savedBoard()

    await workday.fetchRaw(BOARD, getJson, { roles: ["data scientist"] })

    const details = getJson.mock.calls.filter(([url]) => url !== `${BASE}/jobs`).map(([url]) => url.slice(BASE.length))
    expect(details).toHaveLength(SAVED.pages[0].jobPostings.filter((job: { title: string }) => /data scientist/i.test(job.title)).length)
    expect(details).toContain("/job/Lehi/Data-Scientist_R171177-1")
    expect(details.some((path) => path.includes("Enterprise-Architect"))).toBe(false)
  })

  test("asks once per posting even when two role searches find it", async () => {
    const getJson = savedBoard()

    await workday.fetchRaw(BOARD, getJson, { roles: ["data scientist", "scientist"] })

    const details = getJson.mock.calls.filter(([url]) => url !== `${BASE}/jobs`).map(([url]) => url)
    expect(new Set(details).size).toBe(details.length)
  })

  // Builds a request stand-in whose one search page holds the given postings, and which answers any detail request.
  function boardWith(postings: { title: string; externalPath: string; locationsText: string }[]) {
    return vi.fn(async (url: string, _body?: unknown) => (url === `${BASE}/jobs` ? { total: postings.length, jobPostings: postings } : SAVED.details["/job/Lehi/Data-Scientist_R171177-1"]))
  }

  test("does not fetch details for a job whose listed location is abroad, since the feed hides it", async () => {
    const getJson = boardWith([
      { title: "Data Scientist", externalPath: "/job/Bangalore/DS_1", locationsText: "Bangalore, Karnataka, India" },
      { title: "Data Scientist", externalPath: "/job/Austin/DS_2", locationsText: "US, TX, Austin" },
      { title: "Data Scientist", externalPath: "/job/Many/DS_3", locationsText: "3 Locations" },
    ])

    await workday.fetchRaw(BOARD, getJson, { roles: ["data scientist"] })

    const details = getJson.mock.calls.filter(([url]) => url !== `${BASE}/jobs`).map(([url]) => url.slice(BASE.length))
    expect(details).toEqual(["/job/Austin/DS_2", "/job/Many/DS_3"])
  })

  test("does not fetch details for a title holding a word the settings leave out, such as Senior", async () => {
    const getJson = boardWith([
      { title: "Senior Data Scientist", externalPath: "/job/Austin/DS_1", locationsText: "US, TX, Austin" },
      { title: "Data Scientist", externalPath: "/job/Austin/DS_2", locationsText: "US, TX, Austin" },
    ])

    await workday.fetchRaw(BOARD, getJson, { roles: ["data scientist"], excludeTitleWords: ["senior"] })

    const details = getJson.mock.calls.filter(([url]) => url !== `${BASE}/jobs`).map(([url]) => url.slice(BASE.length))
    expect(details).toEqual(["/job/Austin/DS_2"])
  })

  test("refuses to read a Workday board without roles, since listing every job would take hours", async () => {
    await expect(workday.fetchRaw(BOARD, savedBoard(), { roles: [] })).rejects.toThrow(
      "Workday board 'adobe|wd5|external_experienced' needs roles in data/settings.json, so only matching jobs are read.",
    )
  })

  test("refuses a board name that is not tenant|wdN|site", async () => {
    await expect(workday.fetchRaw({ slug: "adobe" }, savedBoard(), { roles: ["analyst"] })).rejects.toThrow(
      "Workday board 'adobe' must be written as tenant|wdN|site, for example adobe|wd5|external_experienced.",
    )
  })
})

describe("workday: reading jobs", () => {
  test("turns a job with details into a record", async () => {
    const raw = await workday.fetchRaw(BOARD, savedBoard(), { roles: ["data scientist"] })

    const [job] = workday.readJobs(raw, BOARD.slug, SEEN_AT)

    const { description, ...rest } = job!
    expect(rest).toEqual({
      key: "workday:adobe|wd5|external_experienced:921d24bd02861001590d1dfbaa200000",
      ats: "workday",
      slug: "adobe|wd5|external_experienced",
      company: "adobe",
      id: "921d24bd02861001590d1dfbaa200000",
      title: "Data Scientist",
      url: "https://adobe.wd5.myworkdayjobs.com/external_experienced/job/Lehi/Data-Scientist_R171177-1",
      locations: ["Lehi", "San Jose"],
      country: "US",
      postedAt: "2026-09-18",
      firstSeenAt: SEEN_AT,
      lastSeenAt: SEEN_AT,
    })
    expect(description).toContain("Adobe Digital Insights")
    expect(description).not.toMatch(/<h2>|<p>/)
  })

  test("refuses an answer without a postings list", () => {
    expect(() => workday.readJobs({ nothing: true }, BOARD.slug, SEEN_AT)).toThrow(
      "Workday board 'adobe|wd5|external_experienced' sent an answer without a postings list.",
    )
  })
})

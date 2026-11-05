// Tests that getJobs tags, scores and ranks every job without dropping any, and that applyFilters hides jobs with a reason.
import type { Profile } from "@auto-applier/core"
import { describe, expect, test } from "vitest"
import { parseSettings } from "../settings"
import type { JobRecord } from "../types"
import { applyFilters } from "./applyFilters"
import { getJobs } from "./getJobs"

const NOW = new Date("2026-11-04T12:00:00Z")

const PROFILE: Profile = {
  personal: { firstName: "Sam", lastName: "Rivera", email: "sam@example.com", phone: "5550100", links: {} },
  experience: [],
  education: [],
  skills: ["Python", "SQL"],
  answers: { workAuthorization: "F-1 OPT", needsSponsorship: true, isAuthorizedToWork: true },
}

const SETTINGS = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } })

// Builds a US job posted a day before NOW, with the given details.
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
    postedAt: "2026-11-03T00:00:00Z",
    firstSeenAt: "2026-11-03T00:00:00Z",
    lastSeenAt: "2026-11-04T00:00:00Z",
    description: "Python and SQL.",
    ...details,
  }
}

describe("getJobs", () => {
  test("ranks every job by score, best first, and keeps all of them", () => {
    const jobs = [job("weak", { description: "Looker and Tableau." }), job("strong"), job("half", { description: "Python and Looker." })]

    const ranked = getJobs(SETTINGS, PROFILE, jobs)

    expect(ranked.map((entry) => [entry.job.id, entry.score])).toEqual([
      ["strong", 77],
      ["half", 53],
      ["weak", 30],
    ])
  })

  test("breaks a tie with the newer posting first", () => {
    const ranked = getJobs(SETTINGS, PROFILE, [job("older", { postedAt: "2026-10-01T00:00:00Z" }), job("newer")])

    expect(ranked.map((entry) => entry.job.id)).toEqual(["newer", "older"])
  })

  test("puts a likely-blocked job below an equal-scoring job that is fine, before looking at dates", () => {
    const refuses = "Python and SQL. We are unable to sponsor visas for this role."
    const ranked = getJobs(SETTINGS, PROFILE, [job("refuses", { description: refuses }), job("fine", { postedAt: "2026-10-01T00:00:00Z" })])

    expect(ranked.map((entry) => [entry.job.id, entry.effect])).toEqual([
      ["fine", "ok"],
      ["refuses", "likely-blocked"],
    ])
  })

  test("adds each company's H-1B history when it is given, and leaves it out when not", () => {
    const history = { data: { fiscalYear: 2026, employers: { acme: { name: "ACME INC", approvals: 12, newEmploymentApprovals: 5, denials: 1 } } }, aliases: {} }

    const [withHistory] = getJobs(SETTINGS, PROFILE, [job("1")], history)
    const [without] = getJobs(SETTINGS, PROFILE, [job("1")])

    expect(withHistory!.history).toEqual({ status: "matched", how: "exact", employer: "ACME INC", approvals: 12, newEmploymentApprovals: 5, fiscalYear: 2026 })
    expect(without!.history).toBeUndefined()
  })

  test("reads pay from the posting text, and prefers the pay the board itself gives", () => {
    const text = "Python and SQL. The base salary range is $95,000 - $115,000."
    const board = { min: 100000, max: 120000, currency: "USD", per: "year" as const, from: "board" as const }

    const [fromText] = getJobs(SETTINGS, PROFILE, [job("1", { description: text })])
    const [fromBoard] = getJobs(SETTINGS, PROFILE, [job("1", { description: text, pay: board })])
    const [none] = getJobs(SETTINGS, PROFILE, [job("1")])

    expect(fromText!.pay).toEqual({ min: 95000, max: 115000, currency: "USD", per: "year", from: "text" })
    expect(fromBoard!.pay).toEqual(board)
    expect(none!.pay).toBeUndefined()
  })

  test("adds the work-authorization tags and what they mean for the user", () => {
    const [entry] = getJobs(SETTINGS, PROFILE, [job("1", { description: "Python. U.S. citizenship required." })])

    expect(entry!.tags.map((found) => found.tag)).toEqual(["citizen-only"])
    expect(entry!.effect).toBe("blocked")
  })
})

describe("applyFilters", () => {
  // Ranks the jobs and splits them, returning the hidden jobs' ids with their reasons.
  function hiddenReasons(jobs: JobRecord[], settings = SETTINGS) {
    const { hidden } = applyFilters(getJobs(settings, PROFILE, jobs), settings, NOW)
    return hidden.map(({ job: entry, reason }) => [entry.job.id, reason])
  }

  test("shows a job that passes every filter", () => {
    expect(applyFilters(getJobs(SETTINGS, PROFILE, [job("1")]), SETTINGS, NOW).shown).toHaveLength(1)
  })

  test("hides each kind of job with its reason", () => {
    const jobs = [
      job("abroad", { country: "other", locations: ["Berlin, Germany"] }),
      job("blocked", { description: "U.S. citizenship required." }),
      job("role", { title: "Account Executive" }),
      job("word", { title: "Senior Data Analyst" }),
      job("level", { title: "Data Analyst II" }),
      job("old", { postedAt: "2026-05-01T00:00:00Z" }),
      job("experience", { description: "Python and SQL. 5+ years of experience." }),
    ]

    expect(Object.fromEntries(hiddenReasons(jobs))).toEqual({
      abroad: "abroad",
      blocked: "blocked",
      role: "role",
      word: "title-word",
      level: "level",
      old: "old",
      experience: "experience",
    })
  })

  test("hides a job that requires a higher degree than the user's, and keeps it when the user has not said", () => {
    const jobs = [job("phd", { description: "Python and SQL. PhD in Statistics or a related field." }), job("master", { description: "Python. Master's degree in Statistics." })]
    const withDegree = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"], myDegree: "master" } })

    expect(hiddenReasons(jobs, withDegree)).toEqual([["phd", "degree"]])
    expect(hiddenReasons(jobs)).toEqual([])
  })

  test("shows likely-blocked jobs unless the settings hide them", () => {
    const jobs = [job("1", { description: "Python. We are unable to sponsor visas." })]

    expect(hiddenReasons(jobs)).toEqual([])
    expect(hiddenReasons(jobs, parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"], hideLikelyBlocked: true } }))).toEqual([
      ["1", "likely-blocked"],
    ])
  })

  test("keeps jobs whose level or country cannot be told, rather than hiding them", () => {
    expect(hiddenReasons([job("1", { country: undefined, locations: ["Remote"] })])).toEqual([])
  })

  test("filters by place, remote work, company and score when asked", () => {
    const settings = parseSettings({
      workAuth: { status: "f1-opt" },
      filters: { roles: ["data analyst"], locations: ["TX"], remoteOnly: false, companies: { exclude: ["Globex"] }, minScore: 90 },
    })
    const jobs = [job("place", { locations: ["Seattle, WA"] }), job("company", { company: "Globex" }), job("score", { description: "Python and Looker." })]

    expect(hiddenReasons(jobs, settings)).toEqual([
      ["place", "location"],
      ["company", "company"],
      ["score", "score"],
    ])
  })

  test("never loses a job: shown and hidden add up to everything", () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job(String(i), { title: i % 3 === 0 ? "Senior Data Analyst" : "Data Analyst", country: i % 4 === 0 ? "other" : "US" }))

    const { shown, hidden } = applyFilters(getJobs(SETTINGS, PROFILE, jobs), SETTINGS, NOW)

    expect(shown.length + hidden.length).toBe(30)
  })
})

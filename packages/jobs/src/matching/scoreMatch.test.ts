// Tests that scoreMatch scores a job by the share of its named skills the user has and by its title, and says why.
import { describe, expect, test } from "vitest"
import { scoreMatch } from "./scoreMatch"

const ME = { skills: ["Python", "SQL", "Tableau"], roles: ["data analyst", "data scientist"] }

describe("scoreMatch", () => {
  test("lists the skills the job names that the user has and the ones they lack", () => {
    const { reasons } = scoreMatch({ title: "Data Analyst", description: "Use SQL, Python and Looker daily." }, ME)

    expect(reasons).toEqual({ matchedSkills: ["SQL", "Python"], missingSkills: ["Looker"], titleMatches: true, level: undefined, yearsRequired: undefined })
  })

  test("scores 70 for skills in proportion and 30 for a wanted title", () => {
    expect(scoreMatch({ title: "Data Analyst", description: "SQL, Python and Looker." }, ME).score).toBe(77)
    expect(scoreMatch({ title: "Business Analyst", description: "SQL, Python and Looker." }, ME).score).toBe(47)
  })

  test("counts at least three skills in the share, so a posting that names one skill cannot score full marks", () => {
    expect(scoreMatch({ title: "Data Analyst", description: "Strong SQL." }, ME).score).toBe(53)
    expect(scoreMatch({ title: "Data Analyst", description: "SQL and Python." }, ME).score).toBe(77)
  })

  test("gives a job that names no known skills only the title part", () => {
    expect(scoreMatch({ title: "Data Scientist", description: "Join our team." }, ME)).toMatchObject({ score: 30, reasons: { matchedSkills: [], missingSkills: [] } })
  })

  test("matches a role in the title as whole words, ignoring case", () => {
    expect(scoreMatch({ title: "Senior DATA SCIENTIST, Ads", description: "" }, ME).reasons.titleMatches).toBe(true)
    expect(scoreMatch({ title: "Metadata Analyst", description: "" }, ME).reasons.titleMatches).toBe(false)
  })

  test("counts a profile skill the skill list does not know", () => {
    const { reasons } = scoreMatch({ title: "Data Analyst", description: "We model in dbt." }, { ...ME, skills: [...ME.skills, "dbt"] })

    expect(reasons.matchedSkills).toEqual(["dbt"])
  })

  test("reads the years of experience the posting asks for", () => {
    expect(scoreMatch({ title: "Data Analyst", description: "3+ years of experience with SQL." }, ME).reasons.yearsRequired).toBe(3)
  })

  test("reads the level from the title", () => {
    expect(scoreMatch({ title: "Junior Data Analyst", description: "" }, ME).reasons.level).toBe("entry")
  })

  test("gives the same score whatever order the skills appear in", () => {
    const first = scoreMatch({ title: "Data Analyst", description: "Python then SQL then Looker." }, ME).score
    const second = scoreMatch({ title: "Data Analyst", description: "Looker then SQL then Python." }, ME).score

    expect(first).toBe(second)
  })
})

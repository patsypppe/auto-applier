// Tests that yearsRequired reads how many years of experience a posting asks for, and ignores other mentions of years.
import { describe, expect, test } from "vitest"
import { yearsRequired, yearsWithMaster } from "./experience"

describe("yearsRequired", () => {
  test.each([
    ["3+ years of experience with SQL.", 3],
    ["3-5 years of experience in analytics.", 3],
    ["3 to 5 years experience building models.", 3],
    ["At least 2 years of professional experience.", 2],
    ["A minimum of 4 years' experience in data science.", 4],
    ["5 or more years of relevant experience.", 5],
    ["2+ years in a data analyst role.", 2],
    ["0-2 years of experience.", 0],
    ["Data Scientist (3-5 years experience)", 3],
  ])("reads %s as %i", (text, years) => {
    expect(yearsRequired(text)).toBe(years)
  })

  test.each([
    ["6+ years in product analytics or a closely related role, with strong exposure to user engagement.", 6],
    ["5+ years building, scaling, and running production software.", 5],
    ["8+ years of SW program management.", 8],
    ["15+ years in spacecraft, mission control, or complex aerospace software systems.", 15],
    ["5+ years of experience running Kubernetes in production at scale, ideally Amazon EKS.", 5],
  ])("reads the real-data phrase %s as %i", (text, years) => {
    expect(yearsRequired(text)).toBe(years)
  })

  test.each([["For over 20 years in business, we have served our customers."], ["Founded 30 years ago building tools for analysts."]])(
    "still finds no requirement in the company history %s",
    (text) => {
      expect(yearsRequired(text)).toBeUndefined()
    },
  )

  test("takes the largest requirement when a posting states several", () => {
    expect(yearsRequired("2+ years of Python experience.\n5+ years of industry experience.")).toBe(5)
  })

  test("ignores years that are only preferred", () => {
    expect(yearsRequired("2+ years of experience.\nPreferred: 7+ years of experience leading teams.")).toBe(2)
    expect(yearsRequired("Nice to have: 5+ years of experience.")).toBeUndefined()
  })

  test.each([["For over 20 years, we have served our customers."], ["Applicants must be 18 years of age."], ["We offer 4 weeks of paid leave."]])(
    "finds no requirement in %s",
    (text) => {
      expect(yearsRequired(text)).toBeUndefined()
    },
  )

  test("reads every wish word as a wish, but only in the clause of the years", () => {
    expect(yearsRequired("5+ years of experience desired.")).toBeUndefined()
    expect(yearsRequired("Bachelor's preferred, and 3+ years of experience required.")).toBe(3)
    expect(yearsRequired("Nice to have: Python, 3+ years of experience with Spark.")).toBeUndefined()
  })

  test.each([
    ["Required Experience: 8 years", 8],
    ["6+ years applied ML with explicit search and/or recommendation systems", 6],
  ])("reads the real requirement %s", (text, years) => {
    expect(yearsRequired(text)).toBe(years)
  })
})

describe("yearsWithMaster", () => {
  test.each([
    ["3 to 5 years of experience in analytics, or a master's degree in statistics.", undefined],
    ["Bachelor's degree with 8+ years of experience, master's degree with 5+ years of experience, or Ph.D. with 2+ years of experience.", 5],
    ["Masters with 3 years of experience or Bachelors with 5 years of relevant experience.", 3],
    ["Typically requires a minimum of 7 years of related experience with a Bachelor's degree; or 5 years and a Master's degree; or 4 years with a PhD.", 5],
    ["Strong frontend engineering experience (typically 4+ years, or equivalent: 2+ years with a Master's degree)", 2],
    ["Bachelor's degree or 3+ years' experience in related field", undefined],
    ["Bachelor's degree; OR High school diploma or equivalency certificate, with 4+ years of experience implementing programs", undefined],
    ["2 years working in an electrical or mechanical test/integration environment; OR a bachelor's in a STEM field", undefined],
  ])("reads what a master's holder needs from %s", (text, years) => {
    expect(yearsWithMaster(text)).toBe(years)
  })

  test("is the same as the plain requirement when no degree is offered instead", () => {
    expect(yearsWithMaster("5+ years of experience in data science.")).toBe(5)
  })

  test("keeps the years when the wish is about the kind of experience, or the degree line has no years in it", () => {
    expect(yearsRequired("2+ years of software development experience (preferably with Ruby on Rails)")).toBe(2)
    expect(yearsRequired("12+ years of construction supervision experience required preferably via a General Contractor")).toBe(12)
    expect(yearsWithMaster("10 years' experience (with degree or 15 without) in a large and complex IT environment")).toBe(10)
    expect(yearsWithMaster("equivalent to high school diploma, plus 4 years experience in the mortgage lending industry")).toBe(4)
  })

  test("reads the years stated for a master's among other routes", () => {
    expect(yearsWithMaster("9+ years of experience and Bachelors in related field; or 7 years relevant experience with Masters in related field; or High School Diploma or equivalent and 13 years")).toBe(7)
  })

  test("does not take master data management or MS SQL for a master's degree", () => {
    expect(yearsWithMaster("2-4 years of hands-on experience in Master Data Management (MDM), with Informatica")).toBe(2)
    expect(yearsWithMaster("3+ years of experience with MS SQL Server")).toBe(3)
  })
})

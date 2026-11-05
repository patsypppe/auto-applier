// Tests that yearsRequired reads how many years of experience a posting asks for, and ignores other mentions of years.
import { describe, expect, test } from "vitest"
import { yearsRequired } from "./experience"

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
})

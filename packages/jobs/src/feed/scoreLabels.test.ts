// Tests that scoreLabels compares what the readers find with hand labels, skips what was left unlabelled, and counts wrong hides.
import { describe, expect, test } from "vitest"
import type { JobRecord } from "../types"
import { scoreLabels, type LabelledJob, type Labels } from "./scoreLabels"

const ME = { workAuth: { status: "f1-opt", needsSponsorshipLater: true, stemDegree: true, clearance: "none" }, maxYears: 2, degree: "master" } as const

// Builds a labelled US job with the given text, details and labels, where unset labels say the posting states nothing.
function labelled(description: string, labels: Partial<Labels> = {}, details: Partial<JobRecord> = {}): LabelledJob {
  const job: JobRecord = {
    key: "greenhouse:acme:1",
    ats: "greenhouse",
    slug: "acme",
    company: "Acme",
    id: "1",
    title: "Data Analyst",
    url: "https://boards.example/1",
    locations: ["Austin, TX"],
    country: "US",
    firstSeenAt: "2026-11-03T00:00:00Z",
    lastSeenAt: "2026-11-04T00:00:00Z",
    description,
    ...details,
  }
  return { job, labels: { restrictions: [], years: null, degree: null, pay: null, abroad: false, ...labels } }
}

describe("scoreLabels", () => {
  test("counts a job as right on every field when the readers agree with its labels", () => {
    const report = scoreLabels([labelled("3+ years of experience. Bachelor's degree in Statistics. U.S. citizenship required.", { restrictions: ["citizen-only"], years: 3, degree: "bachelor" })], ME)

    expect(report.fields.tags).toMatchObject({ right: 1, total: 1 })
    expect(report.fields.years).toMatchObject({ right: 1, total: 1 })
    expect(report.fields.degree).toMatchObject({ right: 1, total: 1 })
    expect(report.fields.pay).toMatchObject({ right: 1, total: 1 })
    expect(report.fields.abroad).toMatchObject({ right: 1, total: 1 })
  })

  test("lists each miss with what was read and what the label says", () => {
    const report = scoreLabels([labelled("5+ years of experience.", { years: 2 })], ME)

    expect(report.fields.years).toMatchObject({ right: 0, total: 1 })
    expect(report.fields.years.misses).toEqual(["Acme | Data Analyst: read 5, label 2"])
  })

  test("does not score a field labelled with a question mark", () => {
    const report = scoreLabels([labelled("Great job.", { restrictions: "?", years: "?", degree: "?", pay: "?" })], ME)

    expect(report.fields.tags.total).toBe(0)
    expect(report.fields.years.total).toBe(0)
    expect(report.fields.degree.total).toBe(0)
    expect(report.fields.pay.total).toBe(0)
  })

  test("treats no future sponsorship as covering no sponsorship, and citizens only as covering U.S. persons", () => {
    const refusal = "We will not sponsor visas now or in the future. U.S. citizenship required. Must be a U.S. person."
    const report = scoreLabels([labelled(refusal, { restrictions: ["no-future-sponsorship", "citizen-only"] })], ME)

    expect(report.fields.tags).toMatchObject({ right: 1, total: 1 })
  })

  test("leaves unclear and not-stated tags out of the comparison", () => {
    const report = scoreLabels([labelled("Visa status will be discussed.", { restrictions: [] })], ME)

    expect(report.fields.tags).toMatchObject({ right: 1, total: 1 })
  })

  test("compares pay by its amounts and unit", () => {
    const pay = "The salary range is $100,000 - $120,000 per year."

    expect(scoreLabels([labelled(pay, { pay: { min: 100000, max: 120000, per: "year" } })], ME).fields.pay.right).toBe(1)
    expect(scoreLabels([labelled(pay, { pay: { min: 90000, max: 120000, per: "year" } })], ME).fields.pay.misses).toHaveLength(1)
  })

  test("counts a job the readers hide that the labels would show as wrongly hidden", () => {
    const report = scoreLabels([labelled("5+ years of experience.", { years: 1 })], ME)

    expect(report.hide).toMatchObject({ right: 0, total: 1, wronglyHidden: ["Acme | Data Analyst: hidden for experience, labels say show"], wronglyShown: [] })
  })

  test("counts a job the labels would hide that the readers show as wrongly shown", () => {
    const report = scoreLabels([labelled("Great job.", { restrictions: ["citizen-only"] })], ME)

    expect(report.hide).toMatchObject({ right: 0, total: 1, wronglyHidden: [], wronglyShown: ["Acme | Data Analyst: shown, labels say blocked"] })
  })

  test("calls it right when both would hide, even for different reasons, and leaves out jobs with unlabelled fields", () => {
    const hiddenEitherWay = labelled("U.S. citizenship required.", { restrictions: ["citizen-only"], years: 5 })
    const unlabelled = labelled("Great job.", { years: "?" })

    expect(scoreLabels([hiddenEitherWay, unlabelled], ME).hide).toMatchObject({ right: 1, total: 1 })
  })

  test("reads a job as abroad only when its country is other", () => {
    const report = scoreLabels([labelled("Great job.", { abroad: true }, { country: undefined, locations: ["London"] })], ME)

    expect(report.fields.abroad.misses).toEqual(["Acme | Data Analyst: read false, label true"])
  })
})

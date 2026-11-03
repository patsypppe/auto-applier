// Tests that report summaries count outcomes correctly, merge across frames, separate AI work and read back safely.
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import type { FieldOutcome, FieldReport } from "./fillPage"
import {
  addSummaries,
  emptySummary,
  explainReport,
  formatSummary,
  isReportSummary,
  needsAttention,
  needsReview,
  summarizeReports,
} from "./summary"

// Builds a report with the given outcome, optionally marked as AI work.
function report(outcome: FieldOutcome, source?: FieldReport["source"]): FieldReport {
  return { field: {} as FormField, outcome, source }
}

const ALL_SEVEN = { filled: 1, aiFilled: 2, drafted: 3, skipped: 4, failed: 5, unmatched: 6, noValue: 7 }

describe("emptySummary", () => {
  test("has a zero for every outcome", () => {
    expect(emptySummary()).toEqual({ filled: 0, aiFilled: 0, drafted: 0, skipped: 0, failed: 0, unmatched: 0, noValue: 0 })
  })
})

describe("summarizeReports", () => {
  test("counts each kind of outcome", () => {
    const reports = [
      report({ status: "filled" }),
      report({ status: "filled" }),
      report({ status: "filled" }, "ai"),
      report({ status: "drafted" }, "ai"),
      report({ status: "skipped", reason: "Field already has a value" }),
      report({ status: "failed", reason: "boom" }),
      report({ status: "unmatched" }),
      report({ status: "no-value", profileKey: "linkedin" }),
      report({ status: "no-value", profileKey: "github" }),
    ]

    expect(summarizeReports(reports)).toEqual({
      filled: 2,
      aiFilled: 1,
      drafted: 1,
      skipped: 1,
      failed: 1,
      unmatched: 1,
      noValue: 2,
    })
  })

  test("returns zeros for no reports", () => {
    expect(summarizeReports([])).toEqual(emptySummary())
  })
})

describe("addSummaries", () => {
  test("adds the counts together", () => {
    const doubled = { filled: 2, aiFilled: 4, drafted: 6, skipped: 8, failed: 10, unmatched: 12, noValue: 14 }

    expect(addSummaries(ALL_SEVEN, ALL_SEVEN)).toEqual(doubled)
  })
})

describe("needsAttention", () => {
  test.each([
    [{ status: "failed", reason: "x" }, true],
    [{ status: "unmatched" }, true],
    [{ status: "no-value", profileKey: "email" }, true],
    [{ status: "filled" }, false],
    [{ status: "drafted" }, false],
    [{ status: "skipped", reason: "Field already has a value" }, false],
  ] as [FieldOutcome, boolean][])("%j needs attention: %s", (outcome, expected) => {
    expect(needsAttention(report(outcome))).toBe(expected)
  })
})

describe("needsReview", () => {
  test("is true for a drafted answer and for a field filled with the AI's help", () => {
    expect(needsReview(report({ status: "drafted" }, "ai"))).toBe(true)
    expect(needsReview(report({ status: "filled" }, "ai"))).toBe(true)
  })

  test("is false for ordinary fills and for everything else", () => {
    expect(needsReview(report({ status: "filled" }))).toBe(false)
    expect(needsReview(report({ status: "skipped", reason: "x" }))).toBe(false)
    expect(needsReview(report({ status: "failed", reason: "x" }, "ai"))).toBe(false)
    expect(needsReview(report({ status: "unmatched" }))).toBe(false)
  })
})

describe("isReportSummary", () => {
  test("accepts a complete summary", () => {
    expect(isReportSummary(emptySummary())).toBe(true)
  })

  test("rejects a summary with a missing count, including the AI counts", () => {
    expect(isReportSummary({ filled: 1, skipped: 0, failed: 0, unmatched: 0, noValue: 0 })).toBe(false)
    const { drafted: _drafted, ...withoutDrafted } = emptySummary()
    expect(isReportSummary(withoutDrafted)).toBe(false)
  })

  test("rejects a count that is not a number", () => {
    expect(isReportSummary({ ...emptySummary(), filled: "3" })).toBe(false)
  })

  test("rejects values that are not objects", () => {
    expect(isReportSummary(null)).toBe(false)
    expect(isReportSummary(undefined)).toBe(false)
    expect(isReportSummary("summary")).toBe(false)
  })
})

describe("formatSummary", () => {
  test("shows filled, left alone and needs-you counts", () => {
    const summary = { ...emptySummary(), filled: 7, skipped: 1, failed: 1, unmatched: 1, noValue: 1 }

    expect(formatSummary(summary)).toBe("Filled 7 · Left alone 1 · Needs you 3")
  })

  test("counts AI work as filled and says how many to check", () => {
    const summary = { ...emptySummary(), filled: 5, aiFilled: 2, drafted: 1, unmatched: 1 }

    expect(formatSummary(summary)).toBe("Filled 8 · Left alone 0 · Needs you 1 · Check the AI's work on 3")
  })

  test("says so when there were no fields", () => {
    expect(formatSummary(emptySummary())).toBe("No fillable fields found.")
  })
})

describe("explainReport", () => {
  test("says why a field failed, with the page's reason", () => {
    expect(explainReport(report({ status: "failed", reason: 'No single option matches "Indiana"' }))).toBe('Failed: No single option matches "Indiana"')
  })

  test("says a field was not recognised, and which profile item is missing for a no-value field", () => {
    expect(explainReport(report({ status: "unmatched" }))).toBe("Not recognised by the rules")
    expect(explainReport(report({ status: "no-value", profileKey: "linkedin" }))).toBe("Your profile has no value for linkedin")
  })

  test("says what was left alone and why", () => {
    expect(explainReport(report({ status: "skipped", reason: "Field already has a value" }))).toBe("Left alone: Field already has a value")
  })

  test("says when the AI was asked and did not settle a field", () => {
    expect(explainReport({ ...report({ status: "unmatched" }), askedAi: true })).toBe("Not recognised by the rules. The AI was asked and left it blank.")
    expect(explainReport({ ...report({ status: "failed", reason: "x" }), askedAi: true })).toBe("Failed: x. The AI was asked and did not settle it.")
  })

  test("says what the AI wrote or chose", () => {
    expect(explainReport(report({ status: "filled" }, "ai"))).toBe("Chosen by the AI")
    expect(explainReport(report({ status: "drafted" }, "ai"))).toBe("Written by the AI")
  })

  test("says a plain fill came from the profile", () => {
    expect(explainReport(report({ status: "filled" }))).toBe("Filled from your profile")
  })
})

describe("a fill that fell back to Other", () => {
  test("is explained, needs a check, and is counted with the AI's work", () => {
    const fallback = report({ status: "filled" }, "fallback")

    expect(explainReport(fallback)).toBe('Picked "Other": nothing in the list matched')
    expect(needsReview(fallback)).toBe(true)
    expect(needsAttention(fallback)).toBe(false)
    expect(summarizeReports([fallback]).aiFilled).toBe(1)
  })
})

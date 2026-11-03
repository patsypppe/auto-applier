// Tests that report summaries count outcomes correctly, merge across frames and read back safely.
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import type { FieldOutcome, FieldReport } from "./fillPage"
import {
  addSummaries,
  emptySummary,
  formatSummary,
  isReportSummary,
  needsAttention,
  summarizeReports,
} from "./summary"

// Builds a report with the given outcome.
function report(outcome: FieldOutcome): FieldReport {
  return { field: {} as FormField, outcome }
}

describe("emptySummary", () => {
  test("has a zero for every outcome", () => {
    expect(emptySummary()).toEqual({ filled: 0, skipped: 0, failed: 0, unmatched: 0, noValue: 0 })
  })
})

describe("summarizeReports", () => {
  test("counts each kind of outcome", () => {
    const reports = [
      report({ status: "filled" }),
      report({ status: "filled" }),
      report({ status: "skipped", reason: "Field already has a value" }),
      report({ status: "failed", reason: "boom" }),
      report({ status: "unmatched" }),
      report({ status: "no-value", profileKey: "linkedin" }),
      report({ status: "no-value", profileKey: "github" }),
    ]

    expect(summarizeReports(reports)).toEqual({ filled: 2, skipped: 1, failed: 1, unmatched: 1, noValue: 2 })
  })

  test("returns zeros for no reports", () => {
    expect(summarizeReports([])).toEqual(emptySummary())
  })
})

describe("addSummaries", () => {
  test("adds the counts together", () => {
    const first = { filled: 1, skipped: 2, failed: 3, unmatched: 4, noValue: 5 }
    const second = { filled: 10, skipped: 20, failed: 30, unmatched: 40, noValue: 50 }

    expect(addSummaries(first, second)).toEqual({ filled: 11, skipped: 22, failed: 33, unmatched: 44, noValue: 55 })
  })
})

describe("needsAttention", () => {
  test.each([
    [{ status: "failed", reason: "x" }, true],
    [{ status: "unmatched" }, true],
    [{ status: "no-value", profileKey: "email" }, true],
    [{ status: "filled" }, false],
    [{ status: "skipped", reason: "Field already has a value" }, false],
  ] as [FieldOutcome, boolean][])("%j needs attention: %s", (outcome, expected) => {
    expect(needsAttention(report(outcome))).toBe(expected)
  })
})

describe("isReportSummary", () => {
  test("accepts a complete summary", () => {
    expect(isReportSummary(emptySummary())).toBe(true)
  })

  test("rejects a summary with a missing count", () => {
    expect(isReportSummary({ filled: 1, skipped: 0, failed: 0, unmatched: 0 })).toBe(false)
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
    const summary = { filled: 7, skipped: 1, failed: 1, unmatched: 1, noValue: 1 }

    expect(formatSummary(summary)).toBe("Filled 7 · Left alone 1 · Needs you 3")
  })

  test("says so when there were no fields", () => {
    expect(formatSummary(emptySummary())).toBe("No fillable fields found.")
  })
})

// Tests the progress numbers a fill reports while it runs, and the check for them arriving from another script.
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import type { FieldOutcome, FieldReport } from "./fillPage"
import { countFilled, isFillProgress } from "./progress"

// Builds a report with the given outcome.
function report(outcome: FieldOutcome): FieldReport {
  return { field: {} as FormField, outcome }
}

describe("countFilled", () => {
  test("counts fields that were filled or drafted, and nothing else", () => {
    const reports = [
      report({ status: "filled" }),
      report({ status: "drafted" }),
      report({ status: "skipped", reason: "x" }),
      report({ status: "failed", reason: "x" }),
      report({ status: "unmatched" }),
      report({ status: "no-value", profileKey: "linkedin" }),
    ]

    expect(countFilled(reports)).toBe(2)
  })

  test("is zero for no reports", () => {
    expect(countFilled([])).toBe(0)
  })
})

describe("isFillProgress", () => {
  test("accepts a count of filled fields out of a total, with a phase", () => {
    expect(isFillProgress({ total: 22, filled: 5, phase: "rules" })).toBe(true)
  })

  test.each(["rules", "reading", "asking", "answering"])("accepts the %s phase", (phase) => {
    expect(isFillProgress({ total: 1, filled: 0, phase })).toBe(true)
  })

  test("rejects anything else", () => {
    expect(isFillProgress(null)).toBe(false)
    expect(isFillProgress({ total: "22", filled: 5, phase: "rules" })).toBe(false)
    expect(isFillProgress({ total: 22, filled: -1, phase: "rules" })).toBe(false)
    expect(isFillProgress({ total: 5, filled: 6, phase: "rules" })).toBe(false)
    expect(isFillProgress({ total: 22, filled: 5, phase: "nonsense" })).toBe(false)
    expect(isFillProgress({ total: 22, filled: 5 })).toBe(false)
  })
})

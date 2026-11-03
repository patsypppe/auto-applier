// Tests which fields get outlined, in which colour, and that an earlier run's outlines are cleared.
// @vitest-environment jsdom
import type { FieldOutcome, FieldReport } from "@auto-applier/core"
import { beforeEach, describe, expect, test } from "vitest"
import { highlightFlagged } from "./highlightFlagged"

// Builds a report for a fresh input with the given outcome, optionally marked as AI work.
function reportFor(outcome: FieldOutcome, source?: "ai"): FieldReport {
  const element = document.createElement("input")
  document.body.append(element)
  return { field: { element, kind: "text", label: "", name: "", options: [] }, outcome, source }
}

// Returns the outline text the browser would store for a colour.
function outlineFor(color: string): string {
  const probe = document.createElement("input")
  probe.style.outline = `2px solid ${color}`
  return probe.style.outline
}

const RED = "#d93025"
const AMBER = "#f9ab00"
const BLUE = "#1a73e8"

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("highlightFlagged", () => {
  test("outlines a failed field in red", () => {
    const report = reportFor({ status: "failed", reason: "x" })

    highlightFlagged([report])

    expect(report.field.element.style.outline).toBe(outlineFor(RED))
    expect(report.field.element.getAttribute("data-auto-applier")).toBe("failed")
  })

  test("writes the reason on the field so it can be read from the page", () => {
    const failed = reportFor({ status: "failed", reason: "No single option matches" })
    const aiFilled = reportFor({ status: "filled" }, "ai")

    highlightFlagged([failed, aiFilled])

    expect(failed.field.element.getAttribute("data-auto-applier-reason")).toBe("Failed: No single option matches")
    expect(aiFilled.field.element.getAttribute("data-auto-applier-reason")).toBe("Chosen by the AI")
  })

  test("removes the reason together with the outline of an earlier run", () => {
    const report = reportFor({ status: "failed", reason: "x" })
    highlightFlagged([report])

    highlightFlagged([])

    expect(report.field.element.hasAttribute("data-auto-applier-reason")).toBe(false)
  })

  test("outlines fields that are unrecognised or have no data in amber", () => {
    const unmatched = reportFor({ status: "unmatched" })
    const noValue = reportFor({ status: "no-value", profileKey: "linkedin" })

    highlightFlagged([unmatched, noValue])

    expect(unmatched.field.element.style.outline).toBe(outlineFor(AMBER))
    expect(noValue.field.element.style.outline).toBe(outlineFor(AMBER))
    expect(unmatched.field.element.getAttribute("data-auto-applier")).toBe("unmatched")
    expect(noValue.field.element.getAttribute("data-auto-applier")).toBe("no-value")
  })

  test("outlines a drafted answer and an AI-filled field in blue, to be checked", () => {
    const drafted = reportFor({ status: "drafted" }, "ai")
    const aiFilled = reportFor({ status: "filled" }, "ai")

    highlightFlagged([drafted, aiFilled])

    expect(drafted.field.element.style.outline).toBe(outlineFor(BLUE))
    expect(aiFilled.field.element.style.outline).toBe(outlineFor(BLUE))
    expect(drafted.field.element.getAttribute("data-auto-applier")).toBe("review")
  })

  test("leaves ordinary fills and left-alone fields without an outline", () => {
    const filled = reportFor({ status: "filled" })
    const skipped = reportFor({ status: "skipped", reason: "Field already has a value" })

    highlightFlagged([filled, skipped])

    expect(filled.field.element.style.outline).toBe("")
    expect(skipped.field.element.style.outline).toBe("")
    expect(filled.field.element.hasAttribute("data-auto-applier")).toBe(false)
  })

  test("outlines a failed AI fill in red, not blue", () => {
    const report = reportFor({ status: "failed", reason: "x" }, "ai")

    highlightFlagged([report])

    expect(report.field.element.style.outline).toBe(outlineFor(RED))
  })

  test("clears the outlines of an earlier run", () => {
    const first = reportFor({ status: "unmatched" })
    highlightFlagged([first])

    highlightFlagged([])

    expect(first.field.element.style.outline).toBe("")
    expect(first.field.element.hasAttribute("data-auto-applier")).toBe(false)
  })
})

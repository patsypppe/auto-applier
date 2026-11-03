// Outlines fields on the page: red for failures, amber for what needs the user, blue for what the AI wrote or chose.
import { needsAttention, needsReview } from "@auto-applier/core"
import type { FieldReport } from "@auto-applier/core"

const MARK_ATTRIBUTE = "data-auto-applier"
const FAILED_COLOR = "#d93025"
const ATTENTION_COLOR = "#f9ab00"
const REVIEW_COLOR = "#1a73e8"

type Mark = { label: string; color: string }

// Returns how to mark a report, or undefined when the field needs no outline.
function markFor(report: FieldReport): Mark | undefined {
  const { status } = report.outcome
  if (status === "failed") return { label: "failed", color: FAILED_COLOR }
  if (needsAttention(report)) return { label: status, color: ATTENTION_COLOR }
  if (needsReview(report)) return { label: "review", color: REVIEW_COLOR }
  return undefined
}

// Removes the outlines left by an earlier run.
function clearMarks(): void {
  document.querySelectorAll<HTMLElement>(`[${MARK_ATTRIBUTE}]`).forEach((element) => {
    element.style.outline = ""
    element.style.outlineOffset = ""
    element.removeAttribute(MARK_ATTRIBUTE)
  })
}

// Outlines every field that needs the user or a check, after clearing the outlines of a previous run.
export function highlightFlagged(reports: FieldReport[]): void {
  clearMarks()

  for (const report of reports) {
    const mark = markFor(report)
    if (!mark) continue

    const element = report.field.element
    element.setAttribute(MARK_ATTRIBUTE, mark.label)
    element.style.outline = `2px solid ${mark.color}`
    element.style.outlineOffset = "2px"
  }
}

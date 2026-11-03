// Outlines the fields the user still has to deal with on the page: red for failures, amber for the rest.
import { needsAttention } from "@auto-applier/core"
import type { FieldReport } from "@auto-applier/core"

const MARK_ATTRIBUTE = "data-auto-applier"
const FAILED_COLOR = "#d93025"
const ATTENTION_COLOR = "#f9ab00"

// Removes the outlines left by an earlier run.
function clearMarks(): void {
  document.querySelectorAll<HTMLElement>(`[${MARK_ATTRIBUTE}]`).forEach((element) => {
    element.style.outline = ""
    element.style.outlineOffset = ""
    element.removeAttribute(MARK_ATTRIBUTE)
  })
}

// Outlines every field that needs the user, after clearing the outlines of a previous run.
export function highlightFlagged(reports: FieldReport[]): void {
  clearMarks()

  for (const report of reports.filter(needsAttention)) {
    const { status } = report.outcome
    const element = report.field.element
    element.setAttribute(MARK_ATTRIBUTE, status)
    element.style.outline = `2px solid ${status === "failed" ? FAILED_COLOR : ATTENTION_COLOR}`
    element.style.outlineOffset = "2px"
  }
}

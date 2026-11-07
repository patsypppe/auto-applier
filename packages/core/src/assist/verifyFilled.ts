// Checks the fields we filled after the fact: a text field the page emptied again, or one it marked invalid, is reported as failed.
import { describeFieldContext } from "../fields/fieldContext"
import type { FieldReport } from "../fill/fillPage"

// Returns true for a report saying we filled or drafted the field.
function wasFilled(report: FieldReport): boolean {
  return report.outcome.status === "filled" || report.outcome.status === "drafted"
}

// Returns why the page rejected a filled field, or undefined when it looks fine.
function rejection(report: FieldReport): string | undefined {
  const { field } = report
  const element = field.element as HTMLInputElement
  if (field.kind === "text" && element.value === "") return "The page cleared the value after it was filled"
  if (element.getAttribute("aria-invalid") !== "true") return undefined

  const error = describeFieldContext(field).error
  return error ? `The page marked it invalid: ${error}` : "The page marked it invalid"
}

// Re-reads every field we filled and turns the ones the page rejected into failures; every other report is returned as it was.
export function checkFilled(reports: readonly FieldReport[]): FieldReport[] {
  return reports.map((report) => {
    if (!wasFilled(report)) return report

    const reason = rejection(report)
    return reason === undefined ? report : { ...report, outcome: { status: "failed", reason, code: "page-rejected" } }
  })
}

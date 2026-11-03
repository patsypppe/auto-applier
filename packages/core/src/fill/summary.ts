// Counts what happened to each field on a page and turns the counts into short text for the popup.
import type { FieldOutcome, FieldReport } from "./fillPage"

export type ReportSummary = {
  filled: number
  skipped: number
  failed: number
  unmatched: number
  noValue: number
}

const SUMMARY_KEYS: (keyof ReportSummary)[] = ["filled", "skipped", "failed", "unmatched", "noValue"]

const SUMMARY_KEY_BY_STATUS: Record<FieldOutcome["status"], keyof ReportSummary> = {
  filled: "filled",
  skipped: "skipped",
  failed: "failed",
  unmatched: "unmatched",
  "no-value": "noValue",
}

// Returns a summary with a zero for every outcome.
export function emptySummary(): ReportSummary {
  return { filled: 0, skipped: 0, failed: 0, unmatched: 0, noValue: 0 }
}

// Returns true when the field still needs the user: it failed, was not recognised, or the profile has no value for it.
export function needsAttention(report: FieldReport): boolean {
  const { status } = report.outcome
  return status === "failed" || status === "unmatched" || status === "no-value"
}

// Counts how many reports ended in each kind of outcome.
export function summarizeReports(reports: FieldReport[]): ReportSummary {
  return reports.reduce((summary, report) => {
    const key = SUMMARY_KEY_BY_STATUS[report.outcome.status]
    return { ...summary, [key]: summary[key] + 1 }
  }, emptySummary())
}

// Adds two summaries together, for combining the results of several frames.
export function addSummaries(first: ReportSummary, second: ReportSummary): ReportSummary {
  return {
    filled: first.filled + second.filled,
    skipped: first.skipped + second.skipped,
    failed: first.failed + second.failed,
    unmatched: first.unmatched + second.unmatched,
    noValue: first.noValue + second.noValue,
  }
}

// Returns true when an unknown value, such as a received message, has a number for every count.
export function isReportSummary(value: unknown): value is ReportSummary {
  if (typeof value !== "object" || value === null) return false

  const record = value as Record<string, unknown>
  return SUMMARY_KEYS.every((key) => typeof record[key] === "number")
}

// Turns a summary into one short line: how many were filled, left alone, and still need the user.
export function formatSummary(summary: ReportSummary): string {
  const needsYou = summary.failed + summary.unmatched + summary.noValue
  const total = summary.filled + summary.skipped + needsYou
  if (total === 0) return "No fillable fields found."

  return `Filled ${summary.filled} · Left alone ${summary.skipped} · Needs you ${needsYou}`
}

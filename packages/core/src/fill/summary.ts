// Counts what happened to each field on a page and turns the counts into short text for the popup.
import type { FieldOutcome, FieldReport } from "./fillPage"

export type ReportSummary = {
  filled: number
  aiFilled: number
  drafted: number
  skipped: number
  failed: number
  unmatched: number
  noValue: number
}

const SUMMARY_KEYS: (keyof ReportSummary)[] = [
  "filled",
  "aiFilled",
  "drafted",
  "skipped",
  "failed",
  "unmatched",
  "noValue",
]

const SUMMARY_KEY_BY_STATUS: Record<Exclude<FieldOutcome["status"], "filled">, keyof ReportSummary> = {
  drafted: "drafted",
  skipped: "skipped",
  failed: "failed",
  unmatched: "unmatched",
  "no-value": "noValue",
}

// Returns a summary with a zero for every outcome.
export function emptySummary(): ReportSummary {
  return { filled: 0, aiFilled: 0, drafted: 0, skipped: 0, failed: 0, unmatched: 0, noValue: 0 }
}

// Returns true when the field still needs the user: it failed, was not recognised, or the profile has no value for it.
export function needsAttention(report: FieldReport): boolean {
  const { status } = report.outcome
  return status === "failed" || status === "unmatched" || status === "no-value"
}

// Returns true when the field holds something the AI wrote or chose, which the user should check.
export function needsReview(report: FieldReport): boolean {
  const { status } = report.outcome
  return status === "drafted" || (status === "filled" && report.source === "ai")
}

// Returns which count a report belongs to; fills that the AI helped with are counted separately.
function summaryKey(report: FieldReport): keyof ReportSummary {
  const { status } = report.outcome
  if (status === "filled") return report.source === "ai" ? "aiFilled" : "filled"
  return SUMMARY_KEY_BY_STATUS[status]
}

// Counts how many reports ended in each kind of outcome.
export function summarizeReports(reports: FieldReport[]): ReportSummary {
  return reports.reduce((summary, report) => {
    const key = summaryKey(report)
    return { ...summary, [key]: summary[key] + 1 }
  }, emptySummary())
}

// Adds two summaries together, for combining the results of several frames.
export function addSummaries(first: ReportSummary, second: ReportSummary): ReportSummary {
  return {
    filled: first.filled + second.filled,
    aiFilled: first.aiFilled + second.aiFilled,
    drafted: first.drafted + second.drafted,
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

// Turns a summary into one short line: how many were filled, left alone and still need the user, and how many to check.
export function formatSummary(summary: ReportSummary): string {
  const filled = summary.filled + summary.aiFilled + summary.drafted
  const needsYou = summary.failed + summary.unmatched + summary.noValue
  if (filled + summary.skipped + needsYou === 0) return "No fillable fields found."

  const line = `Filled ${filled} · Left alone ${summary.skipped} · Needs you ${needsYou}`
  const toCheck = summary.aiFilled + summary.drafted
  return toCheck > 0 ? `${line} · Check the AI's work on ${toCheck}` : line
}

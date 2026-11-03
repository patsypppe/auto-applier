// Describes how far a fill has got, so a progress bar can follow it, and counts the fields filled so far.
import type { FieldReport } from "./fillPage"

export type FillPhase = "rules" | "reading" | "asking" | "answering"

export type FillProgress = { total: number; filled: number; phase: FillPhase }

export type ProgressListener = (progress: FillProgress) => void

const PHASES: readonly string[] = ["rules", "reading", "asking", "answering"]

// Returns how many reports are fields that were filled or drafted.
export function countFilled(reports: readonly FieldReport[]): number {
  return reports.filter((report) => report.outcome.status === "filled" || report.outcome.status === "drafted").length
}

// Returns true when an unknown value is a well-formed progress report.
export function isFillProgress(value: unknown): value is FillProgress {
  if (typeof value !== "object" || value === null) return false

  const { total, filled, phase } = value as { total?: unknown; filled?: unknown; phase?: unknown }
  return (
    typeof total === "number" &&
    typeof filled === "number" &&
    Number.isInteger(total) &&
    Number.isInteger(filled) &&
    filled >= 0 &&
    filled <= total &&
    typeof phase === "string" &&
    PHASES.includes(phase)
  )
}

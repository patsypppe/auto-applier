// Adds up the fill results reported by the frames of a page into one summary, one list of notes and, if every frame failed, one error.
import { addSummaries, emptySummary } from "@auto-applier/core"
import type { ReportSummary } from "@auto-applier/core"
import type { FillResultMessage } from "../messaging"

export type FrameResult = FillResultMessage["result"]

export type CombinedFill = {
  summary?: ReportSummary
  notes: string[]
  error?: string
}

// Combines the results of every frame: counts are added, notes appear once, and a frame's error only shows when no frame succeeded.
export function combineResults(results: readonly FrameResult[]): CombinedFill {
  const succeeded = results.flatMap((result) => (result.ok ? [result] : []))
  const errors = results.flatMap((result) => (result.ok ? [] : [result.error]))

  if (succeeded.length === 0) return errors.length > 0 ? { notes: [], error: errors[0] } : { notes: [] }

  return {
    summary: succeeded.reduce((total, result) => addSummaries(total, result.summary), emptySummary()),
    notes: [...new Set([...succeeded.flatMap((result) => result.notes), ...errors])],
  }
}

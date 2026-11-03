// Adds up the progress reported by the frames of a page into one progress bar.
import type { FillPhase, FillProgress } from "@auto-applier/core"

const PHASE_ORDER: readonly FillPhase[] = ["rules", "reading", "asking", "answering"]

// Returns the totals of every frame that has fields, showing the furthest step any of them reached, or nothing when no frame has fields.
export function combineProgress(frames: readonly FillProgress[]): FillProgress | undefined {
  const withFields = frames.filter((frame) => frame.total > 0)
  if (withFields.length === 0) return undefined

  const furthest = Math.max(...withFields.map((frame) => PHASE_ORDER.indexOf(frame.phase)))
  return {
    total: withFields.reduce((sum, frame) => sum + frame.total, 0),
    filled: withFields.reduce((sum, frame) => sum + frame.filled, 0),
    phase: PHASE_ORDER[furthest] ?? "rules",
  }
}

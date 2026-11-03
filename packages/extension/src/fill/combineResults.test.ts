// Tests that the results of several frames are added up into one summary, with each note shown once.
import { emptySummary } from "@auto-applier/core"
import type { ReportSummary } from "@auto-applier/core"
import { describe, expect, test } from "vitest"
import { combineResults } from "./combineResults"
import type { FrameResult } from "./combineResults"

const ok = (summary: Partial<ReportSummary>, notes: string[] = []): FrameResult => ({
  ok: true,
  summary: { ...emptySummary(), ...summary },
  notes,
})
const failed = (error: string): FrameResult => ({ ok: false, error })

describe("combineResults", () => {
  test("has nothing to show for no results", () => {
    expect(combineResults([])).toEqual({ notes: [] })
  })

  test("adds up the summaries of every frame", () => {
    const combined = combineResults([ok({ filled: 3, unmatched: 1 }), ok({ filled: 2, skipped: 1 })])

    expect(combined.summary).toMatchObject({ filled: 5, skipped: 1, unmatched: 1 })
    expect(combined.error).toBeUndefined()
  })

  test("shows each note once, in the order first seen", () => {
    const combined = combineResults([ok({}, ["a", "b"]), ok({}, ["b", "c"])])

    expect(combined.notes).toEqual(["a", "b", "c"])
  })

  test("reports the first error when no frame succeeded", () => {
    const combined = combineResults([failed("No saved profile yet."), failed("Another problem")])

    expect(combined.error).toBe("No saved profile yet.")
    expect(combined.summary).toBeUndefined()
  })

  test("keeps the summary and adds a failed frame's error to the notes when another frame succeeded", () => {
    const combined = combineResults([ok({ filled: 2 }, ["a note"]), failed("Filling failed"), failed("Filling failed")])

    expect(combined.summary).toMatchObject({ filled: 2 })
    expect(combined.error).toBeUndefined()
    expect(combined.notes).toEqual(["a note", "Filling failed"])
  })
})

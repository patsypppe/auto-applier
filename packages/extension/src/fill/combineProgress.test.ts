// Tests adding up the progress of the frames of a page into one bar.
import { describe, expect, test } from "vitest"
import { combineProgress } from "./combineProgress"

describe("combineProgress", () => {
  test("is nothing when no frame has reported", () => {
    expect(combineProgress([])).toBeUndefined()
  })

  test("is nothing when the frames have no fields at all", () => {
    expect(combineProgress([{ total: 0, filled: 0, phase: "rules" }])).toBeUndefined()
  })

  test("adds up the totals and filled counts of every frame", () => {
    const combined = combineProgress([
      { total: 20, filled: 8, phase: "rules" },
      { total: 5, filled: 5, phase: "rules" },
    ])

    expect(combined).toMatchObject({ total: 25, filled: 13 })
  })

  test("shows the furthest phase any frame has reached", () => {
    const combined = combineProgress([
      { total: 20, filled: 8, phase: "rules" },
      { total: 5, filled: 5, phase: "asking" },
    ])

    expect(combined?.phase).toBe("asking")
  })

  test("ignores frames without fields", () => {
    const combined = combineProgress([
      { total: 0, filled: 0, phase: "answering" },
      { total: 4, filled: 1, phase: "rules" },
    ])

    expect(combined).toEqual({ total: 4, filled: 1, phase: "rules" })
  })
})

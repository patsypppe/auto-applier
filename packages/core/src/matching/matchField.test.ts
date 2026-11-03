// Tests that the matcher chain returns the first result at or above the confidence threshold.
import { describe, expect, test, vi } from "vitest"
import { CONFIDENCE_THRESHOLD } from "./constants"
import { matchField } from "./matchField"
import type { Matcher, MatchResult } from "./types"
import type { FormField } from "../fields/types"

const field = {} as FormField

// Creates a matcher that always returns the given result.
function fixedMatcher(result: MatchResult | null): Matcher {
  return { match: vi.fn(() => result) }
}

describe("matchField", () => {
  test("returns null when there are no matchers", () => {
    expect(matchField(field, [])).toBeNull()
  })

  test("returns the result of a matcher that is confident enough", () => {
    const result = { profileKey: "email", confidence: 0.9 } as const

    expect(matchField(field, [fixedMatcher(result)])).toEqual(result)
  })

  test("skips a matcher that returns null and uses the next one", () => {
    const result = { profileKey: "phone", confidence: 0.9 } as const

    expect(matchField(field, [fixedMatcher(null), fixedMatcher(result)])).toEqual(result)
  })

  test("skips a result below the threshold and uses the next matcher", () => {
    const weak = { profileKey: "firstName", confidence: 0.5 } as const
    const strong = { profileKey: "lastName", confidence: 0.9 } as const

    expect(matchField(field, [fixedMatcher(weak), fixedMatcher(strong)])).toEqual(strong)
  })

  test("returns null when every result is below the threshold", () => {
    const weak = { profileKey: "firstName", confidence: 0.5 } as const

    expect(matchField(field, [fixedMatcher(weak), fixedMatcher(null)])).toBeNull()
  })

  test("stops at the first confident result without calling later matchers", () => {
    const first = fixedMatcher({ profileKey: "email", confidence: 0.9 })
    const second = fixedMatcher({ profileKey: "phone", confidence: 0.9 })

    matchField(field, [first, second])

    expect(second.match).not.toHaveBeenCalled()
  })

  test("accepts a result exactly at the threshold and rejects one just below it", () => {
    const atThreshold = { profileKey: "email", confidence: CONFIDENCE_THRESHOLD } as const
    const justBelow = { profileKey: "email", confidence: CONFIDENCE_THRESHOLD - 0.01 } as const

    expect(matchField(field, [fixedMatcher(atThreshold)])).toEqual(atThreshold)
    expect(matchField(field, [fixedMatcher(justBelow)])).toBeNull()
  })

  test("uses a custom threshold when one is given", () => {
    const result = { profileKey: "email", confidence: 0.5 } as const

    expect(matchField(field, [fixedMatcher(result)], 0.4)).toEqual(result)
  })
})

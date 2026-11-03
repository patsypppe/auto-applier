// Runs a field through a chain of matchers and keeps the first confident answer.
import type { FormField } from "../fields/types"
import { CONFIDENCE_THRESHOLD } from "./constants"
import type { Matcher, MatchResult } from "./types"

// Returns the first matcher result at or above the threshold, or null when none is confident enough.
export function matchField(
  field: FormField,
  matchers: Matcher[],
  threshold: number = CONFIDENCE_THRESHOLD,
): MatchResult | null {
  for (const matcher of matchers) {
    const result = matcher.match(field)
    if (result && result.confidence >= threshold) return result
  }
  return null
}

// Defines the result of matching a form field to a profile key, and the Matcher contract.
import type { FormField } from "../fields/types"

export type MatchResult = {
  profileKey: string
  confidence: number
}

export interface Matcher {
  match(field: FormField): MatchResult | null
}

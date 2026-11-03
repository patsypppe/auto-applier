// Defines the result of matching a form field to a profile key, and the Matcher contract.
import type { FormField } from "../fields/types"
import type { ProfileKey } from "../profile/keys"

export type MatchResult = {
  profileKey: ProfileKey
  confidence: number
}

export interface Matcher {
  match(field: FormField): MatchResult | null
}

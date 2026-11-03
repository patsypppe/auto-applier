import type { FormField } from "../fields/types"

export type MatchResult = {
  profileKey: string
  confidence: number
}

export interface Matcher {
  match(field: FormField): MatchResult | null
}

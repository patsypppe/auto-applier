// Defines the outcome of filling a field, and the Filler contract.
import type { FormField } from "../fields/types"

// A machine-readable reason a fill failed, so callers can react without reading the message text.
export type FailureCode = "no-option-match" | "no-options" | "page-rejected"

export type FillResult =
  | { status: "filled" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string; code?: FailureCode }

export interface Filler {
  canFill(field: FormField): boolean
  fill(field: FormField, value: string): FillResult | Promise<FillResult>
}

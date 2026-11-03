// Defines the outcome of filling a field, and the Filler contract.
import type { FormField } from "../fields/types"

export type FillResult =
  | { status: "filled" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string }

export interface Filler {
  canFill(field: FormField): boolean
  fill(field: FormField, value: string): FillResult | Promise<FillResult>
}

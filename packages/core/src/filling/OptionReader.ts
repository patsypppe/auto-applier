// Describes a filler that can list a field's choices without choosing one, and tells whether a filler is one.
import type { FormField } from "../fields/types"
import type { Filler } from "./types"

export interface OptionReader {
  readOptions(field: FormField, hint?: string): Promise<string[]>
}

// Returns true when the filler can also read a field's options.
export function readsOptions(filler: Filler): filler is Filler & OptionReader {
  return "readOptions" in filler && typeof filler.readOptions === "function"
}

// Tells a long free-text question apart from a short ordinary field, so only real questions are sent for drafting.
import type { FormField } from "../fields/types"

const LONG_LABEL_WORDS = 6

// Returns true for a text field that is a textarea, whose label asks a question, or whose label is long.
export function isFreeTextQuestion(field: FormField): boolean {
  if (field.kind !== "text") return false
  if (field.element.localName === "textarea") return true

  const label = field.label.trim()
  return label.endsWith("?") || label.split(/\s+/).filter(Boolean).length >= LONG_LABEL_WORDS
}

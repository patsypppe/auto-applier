// Test helper that builds a FormField backed by a real input element (needs a DOM environment).
import type { FormField } from "../fields/types"

type FieldOptions = Partial<Omit<FormField, "element">> & { autocomplete?: string }

// Builds a FormField for tests, with an input element that has the given autocomplete value.
export function makeField({ autocomplete, ...overrides }: FieldOptions = {}): FormField {
  const element = document.createElement("input")
  if (autocomplete) element.setAttribute("autocomplete", autocomplete)
  return { element, kind: "text", label: "", name: "", options: [], ...overrides }
}

// Test helper that loads HTML into the fake page and returns the first FormField discovered in it.
import { discoverFields } from "../fields/discoverFields"
import type { FormField } from "../fields/types"

// Wraps an existing element in a FormField, for controls that discovery skips such as disabled ones.
export function fieldForElement(element: HTMLElement, kind: FormField["kind"]): FormField {
  return { element, kind, label: "", name: "", options: [] }
}

// Puts the HTML in the page body and returns the first field found, or throws if there is none.
export function fieldFromHtml(html: string): FormField {
  document.body.innerHTML = html
  const field = discoverFields(document)[0]
  if (!field) throw new Error("No field found in the test HTML")
  return field
}

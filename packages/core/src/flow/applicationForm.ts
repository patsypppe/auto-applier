// Tells whether the page already shows an application form, so the flow fills it instead of looking for an Apply button.
import { discoverFields } from "../fields/discoverFields"

const MIN_FIELDS = 3

// Returns true when the page has at least three fields the extension could fill.
export function hasApplicationForm(root: ParentNode): boolean {
  return discoverFields(root).length >= MIN_FIELDS
}

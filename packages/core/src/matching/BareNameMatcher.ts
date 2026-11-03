// Matches a bare "Name" field to the full name, but only when the page has no separate first or last name fields.
import type { FormField } from "../fields/types"
import { AttributeMatcher } from "./AttributeMatcher"
import { CONFIDENCE } from "./constants"
import { normalizeText } from "./normalizeText"
import type { Matcher, MatchResult } from "./types"

const BARE_NAME = /^(your |applicant |candidate )?name$/

const attributeMatcher = new AttributeMatcher()

// Returns true when some other field on the page is a first or last name field.
function hasSplitNameFields(field: FormField, fields: FormField[]): boolean {
  return fields.some((other) => {
    if (other === field) return false
    const key = attributeMatcher.match(other)?.profileKey
    return key === "firstName" || key === "lastName"
  })
}

export class BareNameMatcher implements Matcher {
  private readonly fields: FormField[]

  constructor(fields: FormField[]) {
    this.fields = fields
  }

  // Returns the full name for a bare "Name" field when the page has no first or last name fields.
  match(field: FormField): MatchResult | null {
    if (field.kind !== "text" || hasSplitNameFields(field, this.fields)) return null

    const label = normalizeText(field.label)
    if (BARE_NAME.test(label)) return { profileKey: "fullName", confidence: CONFIDENCE.label }
    if (label === "" && normalizeText(field.name) === "name") {
      return { profileKey: "fullName", confidence: CONFIDENCE.name }
    }
    return null
  }
}

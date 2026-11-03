// Matches a form field to a profile key using its autocomplete attribute, label and name.
import type { FieldKind, FormField } from "../fields/types"
import type { ProfileKey } from "../profile/keys"
import { CONFIDENCE } from "./constants"
import { normalizeText } from "./normalizeText"
import type { Matcher, MatchResult } from "./types"

type Rule = {
  key: ProfileKey
  patterns: RegExp[]
  kinds?: FieldKind[]
}

const TEXT_ONLY: FieldKind[] = ["text"]
const SCHOOL_KINDS: FieldKind[] = ["text", "combobox", "select"]
const PLACE_KINDS: FieldKind[] = ["text", "combobox", "select"]
const LOCATION_KINDS: FieldKind[] = ["text", "combobox"]

const AUTOCOMPLETE_KEYS = new Map<string, ProfileKey>([
  ["given-name", "firstName"],
  ["family-name", "lastName"],
  ["additional-name", "middleName"],
  ["name", "fullName"],
  ["email", "email"],
  ["tel", "phone"],
  ["address-level2", "city"],
  ["address-level1", "state"],
  ["country", "country"],
  ["country-name", "country"],
])

// Rules are checked in order, so specific names come before generic ones.
const RULES: Rule[] = [
  { key: "legalName", patterns: [/\blegal (full )?name\b/], kinds: TEXT_ONLY },
  { key: "preferredName", patterns: [/\bpreferred (first )?name\b/, /\bnickname\b/], kinds: TEXT_ONLY },
  { key: "middleName", patterns: [/\bmiddle (name|initial)\b/], kinds: TEXT_ONLY },
  { key: "firstName", patterns: [/\bfirst name\b/, /\bgiven name\b/, /\bforename\b/], kinds: TEXT_ONLY },
  { key: "lastName", patterns: [/\blast name\b/, /\bfamily name\b/, /\bsurname\b/], kinds: TEXT_ONLY },
  { key: "fullName", patterns: [/\bfull name\b/], kinds: TEXT_ONLY },
  { key: "email", patterns: [/\be ?mail\b/], kinds: TEXT_ONLY },
  { key: "phone", patterns: [/\b(phone|mobile|telephone|cell)\b/], kinds: TEXT_ONLY },
  { key: "linkedin", patterns: [/\blinked ?in\b/], kinds: TEXT_ONLY },
  { key: "github", patterns: [/\bgit ?hub\b/], kinds: TEXT_ONLY },
  { key: "portfolio", patterns: [/\b(portfolio|website|personal site)\b/], kinds: TEXT_ONLY },
  { key: "skills", patterns: [/\bskills?\b/], kinds: ["text", "combobox"] },
  { key: "resume", patterns: [/\b(resume|cv|curriculum vitae)\b/], kinds: ["file"] },
  {
    key: "isAuthorizedToWork",
    patterns: [/\b(authori[sz]ed|eligible|permitted) to work\b/, /\bright to work\b/],
  },
  { key: "workAuthorization", patterns: [/\bwork authori[sz]ation\b/] },
  { key: "needsSponsorship", patterns: [/\bsponsor(ship)?\b/] },
  { key: "plansToWorkRemotely", patterns: [/\b(plan|intend|prefer|want|like)s? to work (remotely|from a remote)\b/] },
  {
    key: "currentCompany",
    patterns: [/\b(current|previous|most recent|latest|last)( or (current|previous))? (company|employer)\b/, /\bemployer\b/],
    kinds: TEXT_ONLY,
  },
  {
    key: "currentTitle",
    patterns: [/\bjob title\b/, /\b(current|previous|most recent|latest|last)( or (current|previous))? (title|position|role)\b/],
    kinds: TEXT_ONLY,
  },
  { key: "fieldOfStudy", patterns: [/\bfield of study\b/, /\b(major|discipline)\b/], kinds: SCHOOL_KINDS },
  { key: "school", patterns: [/\b(school|university|college|institution)\b/], kinds: SCHOOL_KINDS },
  { key: "degree", patterns: [/\bdegree\b/], kinds: SCHOOL_KINDS },
  { key: "noticePeriod", patterns: [/\bnotice period\b/] },
  { key: "salaryExpectation", patterns: [/\b(salary|compensation)\b/] },
  { key: "location", patterns: [/\bcity\b.*\b(state|province)\b/, /\b(state|province)\b.*\bcity\b/], kinds: LOCATION_KINDS },
  { key: "city", patterns: [/\bcity\b/], kinds: PLACE_KINDS },
  { key: "state", patterns: [/\b(state|province|region)\b/], kinds: PLACE_KINDS },
  {
    key: "country",
    patterns: [/\bcountry\b(?! of (citizenship|birth|origin))(?!.*\b(code|dial|calling)\b)/],
    kinds: PLACE_KINDS,
  },
  { key: "country", patterns: [/\bcountr(y|ies)\b/], kinds: ["checkbox-group"] },
  {
    key: "location",
    patterns: [/^(current |your |home |candidate )?location\b/, /\bwhere (are|do) you (based|live|located|reside)\b/],
    kinds: LOCATION_KINDS,
  },
]

// Reads the last token of the autocomplete attribute, which names the field's purpose.
function autocompleteKey(field: FormField): ProfileKey | undefined {
  const tokens = (field.element.getAttribute("autocomplete") ?? "").toLowerCase().split(/\s+/)
  return AUTOCOMPLETE_KEYS.get(tokens[tokens.length - 1] ?? "")
}

// Returns the key of the first rule that fits the text and allows the field's kind.
function keyFromText(text: string, kind: FieldKind): ProfileKey | undefined {
  if (text === "") return undefined

  const rule = RULES.find(
    (candidate) =>
      (!candidate.kinds || candidate.kinds.includes(kind)) &&
      candidate.patterns.some((pattern) => pattern.test(text)),
  )
  return rule?.key
}

export class AttributeMatcher implements Matcher {
  // Tries the autocomplete attribute, then the label, then the name, each with its own confidence.
  match(field: FormField): MatchResult | null {
    const fromAutocomplete = autocompleteKey(field)
    if (fromAutocomplete) return { profileKey: fromAutocomplete, confidence: CONFIDENCE.autocomplete }

    const fromLabel = keyFromText(normalizeText(field.label), field.kind)
    if (fromLabel) return { profileKey: fromLabel, confidence: CONFIDENCE.label }

    const fromName = keyFromText(normalizeText(field.name), field.kind)
    return fromName ? { profileKey: fromName, confidence: CONFIDENCE.name } : null
  }
}

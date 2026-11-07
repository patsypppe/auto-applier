// Runs the whole fill pipeline on a page: discover, match, resolve, fill, and report what happened to each field.
import { discoverFields } from "../fields/discoverFields"
import type { FormField } from "../fields/types"
import { CheckboxFiller } from "../filling/CheckboxFiller"
import { CheckboxGroupFiller } from "../filling/CheckboxGroupFiller"
import { ComboboxFiller } from "../filling/ComboboxFiller"
import { RadioFiller } from "../filling/RadioFiller"
import { SelectFiller } from "../filling/SelectFiller"
import { TextFiller } from "../filling/TextFiller"
import type { Filler, FillResult } from "../filling/types"
import { AttributeMatcher } from "../matching/AttributeMatcher"
import { BareNameMatcher } from "../matching/BareNameMatcher"
import { matchField } from "../matching/matchField"
import type { Matcher } from "../matching/types"
import type { ProfileKey } from "../profile/keys"
import { resolveValue } from "../profile/resolveValue"
import type { Profile } from "../profile/types"
import { countFilled } from "./progress"
import type { ProgressListener } from "./progress"

export type FieldOutcome =
  | FillResult
  | { status: "unmatched" }
  | { status: "no-value"; profileKey: ProfileKey }
  | { status: "drafted" }

export type FieldReport = {
  field: FormField
  profileKey?: ProfileKey
  outcome: FieldOutcome
  source?: "ai" | "fallback"
  askedAi?: true
}

export type FillSetup = {
  matchersFor: (fields: FormField[]) => Matcher[]
  fillers: Filler[]
}

export const DEFAULT_SETUP: FillSetup = {
  matchersFor: (fields) => [new AttributeMatcher(), new BareNameMatcher(fields)],
  fillers: [
    new TextFiller(),
    new SelectFiller(),
    new RadioFiller(),
    new CheckboxFiller(),
    new CheckboxGroupFiller(),
    new ComboboxFiller(),
  ],
}

// Returns the message of an error, or a generic one when the thrown value is not an Error.
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Filling failed"
}

// Hands the value to the first filler that can handle the field; a filler that throws becomes a failure.
export async function fillWith(fillers: Filler[], field: FormField, value: string): Promise<FillResult> {
  const filler = fillers.find((candidate) => candidate.canFill(field))
  if (!filler) return { status: "failed", reason: `Nothing can fill ${field.kind} fields yet` }

  try {
    return await filler.fill(field, value)
  } catch (error: unknown) {
    return { status: "failed", reason: errorMessage(error) }
  }
}

// Matches one field to a profile key, looks up the value and fills it, returning the report for that field.
async function processField(
  field: FormField,
  profile: Profile,
  matchers: Matcher[],
  fillers: Filler[],
): Promise<FieldReport> {
  const match = matchField(field, matchers)
  if (!match) return { field, outcome: { status: "unmatched" } }

  const { profileKey } = match
  const value = resolveValue(profile, profileKey)
  if (value === undefined) return { field, profileKey, outcome: { status: "no-value", profileKey } }

  return { field, profileKey, outcome: await fillWith(fillers, field, value) }
}

// Fills the given fields one at a time in the order given and reports each outcome; the listener hears the total first and then after every field.
export async function fillFields(
  fields: FormField[],
  profile: Profile,
  setup: FillSetup = DEFAULT_SETUP,
  onProgress?: ProgressListener,
): Promise<FieldReport[]> {
  const matchers = setup.matchersFor(fields)
  onProgress?.({ total: fields.length, filled: 0, phase: "rules" })

  const reports: FieldReport[] = []
  for (const field of fields) {
    reports.push(await processField(field, profile, matchers, setup.fillers))
    onProgress?.({ total: fields.length, filled: countFilled(reports), phase: "rules" })
  }
  return reports
}

// Fills every field it can find inside the root, one at a time in page order, and reports each field's outcome.
export async function fillPage(
  root: ParentNode,
  profile: Profile,
  setup: FillSetup = DEFAULT_SETUP,
  onProgress?: ProgressListener,
): Promise<FieldReport[]> {
  return fillFields(discoverFields(root), profile, setup, onProgress)
}

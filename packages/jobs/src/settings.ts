// Reads data/settings.json: the user's work authorization and what jobs to show, with defaults and a message for each mistake.
import { readFile } from "node:fs/promises"
import type { Level, WorkAuth, WorkAuthStatus } from "./types"

export const STATUSES: readonly WorkAuthStatus[] = ["citizen", "permanent-resident", "f1-cpt", "f1-opt", "f1-stem-opt", "h1b", "other-needs-sponsorship"]
export const LEVELS: readonly Level[] = ["intern", "new-grad", "entry", "mid", "senior", "staff"]

export type Filters = {
  roles: string[]
  hideBlocked: boolean
  hideLikelyBlocked: boolean
  includeAbroad: boolean
  locations: string[]
  remoteOnly: boolean
  levels: Level[]
  excludeTitleWords: string[]
  postedWithinDays: number
  companies: { include: string[]; exclude: string[] }
  minScore: number
}

export type FeedSettings = { workAuth: WorkAuth; filters: Filters }

type Raw = Record<string, unknown>

// Returns the value as an object, or an empty one when it is missing or not an object.
function objectAt(value: unknown): Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : {}
}

// Returns the value when it is a list of strings, the fallback when it is missing, or undefined when it is something else.
function stringsAt(value: unknown, fallback: string[]): string[] | undefined {
  if (value === undefined) return fallback
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined
}

// Returns the value when it is a boolean, the fallback when it is missing, or undefined when it is something else.
function booleanAt(value: unknown, fallback: boolean): boolean | undefined {
  if (value === undefined) return fallback
  return typeof value === "boolean" ? value : undefined
}

// Reads the work-authorization part, filling in what a person with that status usually has.
function readWorkAuth(raw: Raw, problems: string[]): WorkAuth {
  const status = STATUSES.find((name) => name === raw.status)
  if (!status) problems.push(`workAuth.status must be one of ${STATUSES.join(", ")}.`)
  const known = status ?? "citizen"

  const needsSponsorshipLater = booleanAt(raw.needsSponsorshipLater, known.startsWith("f1-") || known === "h1b" || known === "other-needs-sponsorship")
  const stemDegree = booleanAt(raw.stemDegree, false)
  if (needsSponsorshipLater === undefined) problems.push("workAuth.needsSponsorshipLater must be true or false.")
  if (stemDegree === undefined) problems.push("workAuth.stemDegree must be true or false.")

  const clearances = ["none", "can-obtain", "active"] as const
  const clearance = raw.clearance === undefined ? (known === "citizen" ? "can-obtain" : "none") : clearances.find((name) => name === raw.clearance)
  if (!clearance) problems.push("workAuth.clearance must be one of none, can-obtain, active.")

  return { status: known, needsSponsorshipLater: needsSponsorshipLater ?? false, stemDegree: stemDegree ?? false, clearance: clearance ?? "none" }
}

// Reads the filters part, filling in defaults that suit a student looking for a first job.
function readFilters(raw: Raw, problems: string[]): Filters {
  const roles = stringsAt(raw.roles, [])
  if (!roles || roles.length === 0) problems.push('filters.roles must list at least one job title keyword, such as "data analyst".')

  const levels = stringsAt(raw.levels, ["intern", "new-grad", "entry"])
  const knownLevels = levels?.every((level) => LEVELS.some((name) => name === level)) ? (levels as Level[]) : undefined
  if (!knownLevels) problems.push(`filters.levels may only use ${LEVELS.join(", ")}.`)

  const flags = {
    hideBlocked: booleanAt(raw.hideBlocked, true),
    hideLikelyBlocked: booleanAt(raw.hideLikelyBlocked, false),
    includeAbroad: booleanAt(raw.includeAbroad, false),
    remoteOnly: booleanAt(raw.remoteOnly, false),
  }
  for (const [name, value] of Object.entries(flags)) if (value === undefined) problems.push(`filters.${name} must be true or false.`)

  const lists = {
    locations: stringsAt(raw.locations, []),
    excludeTitleWords: stringsAt(raw.excludeTitleWords, ["senior", "staff", "principal", "manager", "director"]),
  }
  for (const [name, value] of Object.entries(lists)) if (value === undefined) problems.push(`filters.${name} must be a list of words.`)

  const companies = objectAt(raw.companies)
  const include = stringsAt(companies.include, [])
  const exclude = stringsAt(companies.exclude, [])
  if (!include || !exclude) problems.push("filters.companies.include and .exclude must be lists of company names.")

  const days = raw.postedWithinDays ?? 30
  if (typeof days !== "number" || days <= 0) problems.push("filters.postedWithinDays must be a number of days above 0.")
  const minScore = raw.minScore ?? 0
  if (typeof minScore !== "number" || minScore < 0 || minScore > 100) problems.push("filters.minScore must be a number from 0 to 100.")

  return {
    roles: roles ?? [],
    hideBlocked: flags.hideBlocked ?? true,
    hideLikelyBlocked: flags.hideLikelyBlocked ?? false,
    includeAbroad: flags.includeAbroad ?? false,
    locations: lists.locations ?? [],
    remoteOnly: flags.remoteOnly ?? false,
    levels: knownLevels ?? [],
    excludeTitleWords: lists.excludeTitleWords ?? [],
    postedWithinDays: typeof days === "number" ? days : 30,
    companies: { include: include ?? [], exclude: exclude ?? [] },
    minScore: typeof minScore === "number" ? minScore : 0,
  }
}

// Checks parsed settings and returns them with defaults filled in, or throws every mistake found, one per line.
export function parseSettings(raw: unknown): FeedSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("The settings file must be an object with workAuth and filters.")

  const problems: string[] = []
  const settings = { workAuth: readWorkAuth(objectAt((raw as Raw).workAuth), problems), filters: readFilters(objectAt((raw as Raw).filters), problems) }
  if (problems.length > 0) throw new Error(problems.join("\n"))
  return settings
}

// Reads and checks the settings file, or says how to create one.
export async function loadSettings(file: string): Promise<FeedSettings> {
  let text: string
  try {
    text = await readFile(file, "utf8")
  } catch {
    throw new Error(`No settings at ${file}. Copy data.example/settings.example.json to data/settings.json and edit it.`)
  }
  return parseSettings(JSON.parse(text))
}

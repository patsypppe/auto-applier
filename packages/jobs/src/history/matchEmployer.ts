// Finds a company's H-1B filings: by a hand-written alias, by the same name once endings are taken off, or by a filing name
// that only adds a generic word such as Labs or Opco. Anything less certain is reported as ambiguous or none, never guessed.
import { normalizeName } from "./normalizeName"
import type { H1bHistory } from "./readH1bCsv"

// Words a filing name may add to a company's name and still be the same company ("Notion" files as "NOTION LABS INC").
const GENERIC_ENDINGS = new Set([
  "labs", "lab", "technologies", "technology", "tech", "ai", "systems", "solutions", "software", "group", "us", "usa",
  "america", "americas", "international", "global", "operating", "opco", "services", "markets", "financial", "health",
  "therapeutics", "bio", "biosciences", "networks", "robotics", "platforms", "industries", "enterprises", "hq",
])

// Names shorter than this ("STR", "Pico") matched the wrong company too often in the hand check, so a similar filing name
// only makes them ambiguous.
const MIN_LENGTH_FOR_GENERIC = 5

export type EmployerHistory =
  | { status: "matched"; how: "alias" | "exact" | "generic-ending"; employer: string; approvals: number; newEmploymentApprovals: number; fiscalYear: number }
  | { status: "ambiguous"; candidates: string[]; fiscalYear: number }
  | { status: "none"; fiscalYear: number }

// Builds the matched answer for an employer key that is known to be in the history.
function matched(history: H1bHistory, key: string, how: "alias" | "exact" | "generic-ending"): EmployerHistory {
  const found = history.employers[key]!
  return { status: "matched", how, employer: found.name, approvals: found.approvals, newEmploymentApprovals: found.newEmploymentApprovals, fiscalYear: history.fiscalYear }
}

// Returns the company's filings, using the aliases file (company name to filing name) first.
export function matchEmployer(company: string, history: H1bHistory, aliases: Readonly<Record<string, string>>): EmployerHistory {
  const alias = aliases[company]
  if (alias !== undefined && history.employers[normalizeName(alias)]) return matched(history, normalizeName(alias), "alias")

  const key = normalizeName(company)
  if (history.employers[key]) return matched(history, key, "exact")

  const candidates = Object.keys(history.employers).filter((name) => {
    if (!name.startsWith(`${key} `)) return false
    return name.slice(key.length + 1).split(" ").every((word) => GENERIC_ENDINGS.has(word))
  })
  if (candidates.length === 1 && key.length >= MIN_LENGTH_FOR_GENERIC) return matched(history, candidates[0]!, "generic-ending")
  if (candidates.length > 0) {
    return { status: "ambiguous", candidates: candidates.map((name) => history.employers[name]!.name).sort(), fiscalYear: history.fiscalYear }
  }
  return { status: "none", fiscalYear: history.fiscalYear }
}

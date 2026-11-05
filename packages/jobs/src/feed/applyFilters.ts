// Splits ranked jobs into the ones to show and the ones hidden, each hidden job with the first reason that hid it.
import type { FeedSettings } from "../settings"
import type { RankedJob } from "./getJobs"

export type HideReason =
  | "abroad"
  | "blocked"
  | "likely-blocked"
  | "role"
  | "title-word"
  | "level"
  | "experience"
  | "location"
  | "remote"
  | "old"
  | "company"
  | "score"

export type Filtered = { shown: RankedJob[]; hidden: { job: RankedJob; reason: HideReason }[] }

// Returns true when the text holds the word or phrase as whole words, ignoring case.
function hasWords(text: string, words: string): boolean {
  const escaped = words.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text.toLowerCase())
}

// Returns the first reason to hide the job, or undefined when it should be shown. A level or country that cannot be told
// does not hide a job.
function reasonToHide(entry: RankedJob, settings: FeedSettings, now: Date): HideReason | undefined {
  const { job, reasons, effect, score } = entry
  const filters = settings.filters
  const ageDays = (now.getTime() - (Date.parse(job.postedAt ?? job.firstSeenAt) || now.getTime())) / 86_400_000

  if (job.country === "other" && !filters.includeAbroad) return "abroad"
  if (effect === "blocked" && filters.hideBlocked) return "blocked"
  if (effect === "likely-blocked" && filters.hideLikelyBlocked) return "likely-blocked"
  if (filters.roles.length > 0 && !reasons.titleMatches) return "role"
  if (filters.excludeTitleWords.some((word) => hasWords(job.title, word))) return "title-word"
  if (reasons.level && !filters.levels.includes(reasons.level)) return "level"
  if (reasons.yearsRequired !== undefined && reasons.yearsRequired > filters.maxYearsRequired) return "experience"
  if (filters.locations.length > 0 && !job.locations.some((place) => filters.locations.some((wanted) => hasWords(place, wanted)))) return "location"
  if (filters.remoteOnly && !job.locations.some((place) => hasWords(place, "remote"))) return "remote"
  if (ageDays > filters.postedWithinDays) return "old"
  if (filters.companies.include.length > 0 && !filters.companies.include.some((name) => hasWords(job.company, name))) return "company"
  if (filters.companies.exclude.some((name) => hasWords(job.company, name))) return "company"
  if (score < filters.minScore) return "score"
  return undefined
}

// Splits the jobs by the user's filters, keeping their order. Every job ends up in exactly one of the two lists.
export function applyFilters(jobs: readonly RankedJob[], settings: FeedSettings, now: Date = new Date()): Filtered {
  const shown: RankedJob[] = []
  const hidden: Filtered["hidden"] = []
  for (const entry of jobs) {
    const reason = reasonToHide(entry, settings, now)
    if (reason) hidden.push({ job: entry, reason })
    else shown.push(entry)
  }
  return { shown, hidden }
}

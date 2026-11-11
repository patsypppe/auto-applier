// Splits ranked jobs into the ones to show and the ones hidden, each hidden job with the first reason that hid it.
import { DEGREES } from "../matching/degree"
import type { FeedSettings } from "../settings"
import type { Degree, Pay } from "../types"
import type { RankedJob } from "./getJobs"

export const HIDE_REASONS = [
  "abroad",
  "blocked",
  "likely-blocked",
  "role",
  "title-word",
  "level",
  "experience",
  "degree",
  "location",
  "remote",
  "workplace",
  "job-type",
  "pay",
  "old",
  "company",
  "score",
] as const

export type HideReason = (typeof HIDE_REASONS)[number]

const HOURS_A_YEAR = 2080

export type Filtered = { shown: RankedJob[]; hidden: { job: RankedJob; reason: HideReason }[] }

// Returns true when the text holds the word or phrase as whole words, ignoring case.
function hasWords(text: string, words: string): boolean {
  const escaped = words.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text.toLowerCase())
}

// Returns true when the most a job pays in US dollars is below the yearly minimum, taking a year as 2,080 paid hours.
// A job with no pay, or pay in another currency, is kept.
function paysLess(pay: Pay | undefined, minimum: number): boolean {
  if (!pay || minimum <= 0 || pay.currency !== "USD") return false
  return (pay.per === "hour" ? pay.max * HOURS_A_YEAR : pay.max) < minimum
}

// Returns true when the job requires a higher degree than the user's; a user who has not given a degree sees every job.
function needsMoreDegree(required: Degree | undefined, mine: Degree | undefined): boolean {
  return required !== undefined && mine !== undefined && DEGREES.indexOf(required) > DEGREES.indexOf(mine)
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
  if (reasons.level && filters.levels.length > 0 && !filters.levels.includes(reasons.level)) return "level"
  const years = filters.myDegree === "master" || filters.myDegree === "phd" ? reasons.yearsWithMaster : reasons.yearsRequired
  if (years !== undefined && years > filters.maxYearsRequired) return "experience"
  if (needsMoreDegree(reasons.degreeRequired, filters.myDegree)) return "degree"
  if (filters.locations.length > 0 && !job.locations.some((place) => filters.locations.some((wanted) => hasWords(place, wanted)))) return "location"
  if (filters.remoteOnly && job.workplace !== "remote" && !job.locations.some((place) => hasWords(place, "remote"))) return "remote"
  if (job.workplace && filters.workplaces.length > 0 && !filters.workplaces.includes(job.workplace)) return "workplace"
  if (job.jobType && filters.jobTypes.length > 0 && !filters.jobTypes.includes(job.jobType)) return "job-type"
  if (paysLess(entry.pay, filters.minYearlyPay)) return "pay"
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

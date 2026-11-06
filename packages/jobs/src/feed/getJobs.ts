// Tags, scores and ranks every collected job for one user. Nothing is dropped here; hiding is applyFilters' job. The slow
// part, which does not depend on settings.json, is done once by prepareJobs, so new settings only need rankJobs.
import type { Profile } from "@auto-applier/core"
import { matchEmployer, type EmployerHistory } from "../history/matchEmployer"
import type { H1bHistory } from "../history/readH1bCsv"
import { readPay } from "../matching/pay"
import { readMatch, roleMatcher, scoreReads, type JobReads, type MatchReasons } from "../matching/scoreMatch"
import type { FeedSettings } from "../settings"
import { jobEffect } from "../tags/effects"
import { tagJob } from "../tags/tagJob"
import type { Effect, JobRecord, Pay, Tag } from "../types"

export type RankedJob = {
  job: JobRecord
  tags: Tag[]
  effect: Effect
  score: number
  reasons: MatchReasons
  pay?: Pay
  history?: EmployerHistory
}

export type PreparedJob = {
  job: JobRecord
  tags: Tag[]
  reads: JobReads
  pay?: Pay
  history?: EmployerHistory
}

export type HistoryInput = { data: H1bHistory; aliases: Readonly<Record<string, string>> }

// Likely-blocked and blocked jobs go below fine ones of the same score.
const EFFECT_RANK: Record<Effect, number> = { positive: 0, ok: 0, "likely-blocked": 1, blocked: 2 }

// Returns a job's posting date as a number for sorting, newest largest; a job with no date counts from when it was first seen.
function postedTime(job: JobRecord): number {
  return Date.parse(job.postedAt ?? job.firstSeenAt) || 0
}

// Does the work that settings.json does not change: tags, skill, level, years and degree reads, pay from the board or else
// from the text, and, when H-1B history is given, each company's filings, looked up once per company.
export function prepareJobs(profile: Profile, jobs: readonly JobRecord[], history?: HistoryInput): PreparedJob[] {
  const byCompany = new Map<string, EmployerHistory>()
  const historyOf = (company: string): EmployerHistory | undefined => {
    if (!history) return undefined
    const known = byCompany.get(company) ?? matchEmployer(company, history.data, history.aliases)
    byCompany.set(company, known)
    return known
  }

  return jobs.map((job): PreparedJob => {
    const pay = job.pay ?? readPay(job.description)
    const filings = historyOf(job.company)
    return { job, tags: tagJob(job), reads: readMatch(job, profile.skills), ...(pay ? { pay } : {}), ...(filings ? { history: filings } : {}) }
  })
}

// Ranks prepared jobs for these settings: best match first; among equal scores, fine before likely blocked, then newer first.
export function rankJobs(settings: FeedSettings, prepared: readonly PreparedJob[]): RankedJob[] {
  const wanted = roleMatcher(settings.filters.roles)
  return prepared
    .map(({ job, tags, reads, pay, history }): RankedJob => {
      const { score, reasons } = scoreReads(reads, wanted(job.title))
      const effect = jobEffect(tags.map(({ tag }) => tag), settings.workAuth)
      return { job, tags, effect, score, reasons, ...(pay ? { pay } : {}), ...(history ? { history } : {}) }
    })
    .sort((a, b) => b.score - a.score || EFFECT_RANK[a.effect] - EFFECT_RANK[b.effect] || postedTime(b.job) - postedTime(a.job))
}

// Prepares and ranks the jobs in one go, for commands that rank once.
export function getJobs(settings: FeedSettings, profile: Profile, jobs: readonly JobRecord[], history?: HistoryInput): RankedJob[] {
  return rankJobs(settings, prepareJobs(profile, jobs, history))
}

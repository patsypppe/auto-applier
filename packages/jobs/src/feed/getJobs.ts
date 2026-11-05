// Tags, scores and ranks every collected job for one user. Nothing is dropped here; hiding is applyFilters' job.
import type { Profile } from "@auto-applier/core"
import { matchEmployer, type EmployerHistory } from "../history/matchEmployer"
import type { H1bHistory } from "../history/readH1bCsv"
import { readPay } from "../matching/pay"
import { scoreMatch, type MatchReasons } from "../matching/scoreMatch"
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

export type HistoryInput = { data: H1bHistory; aliases: Readonly<Record<string, string>> }

// Likely-blocked and blocked jobs go below fine ones of the same score.
const EFFECT_RANK: Record<Effect, number> = { positive: 0, ok: 0, "likely-blocked": 1, blocked: 2 }

// Returns a job's posting date as a number for sorting, newest largest; a job with no date counts from when it was first seen.
function postedTime(job: JobRecord): number {
  return Date.parse(job.postedAt ?? job.firstSeenAt) || 0
}

// Ranks the jobs for this user: best match first; among equal scores, fine before likely blocked, then newer first.
// Each job gets its pay, from the board or else from its text. When H-1B history is given, each job also gets its
// company's filings, looked up once per company.
export function getJobs(settings: FeedSettings, profile: Profile, jobs: readonly JobRecord[], history?: HistoryInput): RankedJob[] {
  const me = { skills: profile.skills, roles: settings.filters.roles }
  const byCompany = new Map<string, EmployerHistory>()
  const historyOf = (company: string): EmployerHistory | undefined => {
    if (!history) return undefined
    const known = byCompany.get(company) ?? matchEmployer(company, history.data, history.aliases)
    byCompany.set(company, known)
    return known
  }

  return jobs
    .map((job): RankedJob => {
      const tags = tagJob(job)
      const { score, reasons } = scoreMatch(job, me)
      const pay = job.pay ?? readPay(job.description)
      const ranked = { job, tags, effect: jobEffect(tags.map(({ tag }) => tag), settings.workAuth), score, reasons, ...(pay ? { pay } : {}) }
      const filings = historyOf(job.company)
      return filings ? { ...ranked, history: filings } : ranked
    })
    .sort((a, b) => b.score - a.score || EFFECT_RANK[a.effect] - EFFECT_RANK[b.effect] || postedTime(b.job) - postedTime(a.job))
}

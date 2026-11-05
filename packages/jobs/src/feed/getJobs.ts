// Tags, scores and ranks every collected job for one user. Nothing is dropped here; hiding is applyFilters' job.
import type { Profile } from "@auto-applier/core"
import { scoreMatch, type MatchReasons } from "../matching/scoreMatch"
import type { FeedSettings } from "../settings"
import { jobEffect } from "../tags/effects"
import { tagJob } from "../tags/tagJob"
import type { Effect, JobRecord, Tag } from "../types"

export type RankedJob = {
  job: JobRecord
  tags: Tag[]
  effect: Effect
  score: number
  reasons: MatchReasons
}

// Returns a job's posting date as a number for sorting, newest largest; a job with no date counts from when it was first seen.
function postedTime(job: JobRecord): number {
  return Date.parse(job.postedAt ?? job.firstSeenAt) || 0
}

// Ranks the jobs for this user: best match first, and newer first among equal scores.
export function getJobs(settings: FeedSettings, profile: Profile, jobs: readonly JobRecord[]): RankedJob[] {
  const me = { skills: profile.skills, roles: settings.filters.roles }
  return jobs
    .map((job): RankedJob => {
      const tags = tagJob(job)
      const { score, reasons } = scoreMatch(job, me)
      return { job, tags, effect: jobEffect(tags.map(({ tag }) => tag), settings.workAuth), score, reasons }
    })
    .sort((a, b) => b.score - a.score || postedTime(b.job) - postedTime(a.job))
}

// Carries what earlier runs saw into this one: first-seen dates, and links from a reposted job to its earlier copy.
import type { JobRecord } from "../types"

const REMEMBER_DAYS = 60

export type SeenJob = { textHash: string; firstSeenAt: string; lastSeenAt: string; repostOf?: string }
export type SeenJobs = Record<string, SeenJob>

// Returns true when the job was seen within the last REMEMBER_DAYS days.
function isRecent(seen: SeenJob, now: Date): boolean {
  return now.getTime() - Date.parse(seen.lastSeenAt) <= REMEMBER_DAYS * 86_400_000
}

// Indexes the recently seen jobs that are gone from this run by text hash, each pointing at the oldest copy in its chain.
// A job whose earlier copy is still listed is a separate opening with the same text, not a repost.
function earlierCopies(seen: SeenJobs, current: Set<string>, now: Date): Map<string, { key: string; firstSeenAt: string }> {
  const byHash = new Map<string, { key: string; firstSeenAt: string }>()
  for (const [key, entry] of Object.entries(seen)) {
    const oldest = entry.repostOf ?? key
    if (isRecent(entry, now) && !current.has(key) && !current.has(oldest) && !byHash.has(entry.textHash)) {
      byHash.set(entry.textHash, { key: oldest, firstSeenAt: entry.firstSeenAt })
    }
  }
  return byHash
}

// Gives each job its first-seen date and repost link from earlier runs, and returns the updated memory of seen jobs.
export function linkReposts(jobs: readonly JobRecord[], seen: SeenJobs, now: Date): { jobs: JobRecord[]; seen: SeenJobs } {
  const nowText = now.toISOString()
  const byHash = earlierCopies(seen, new Set(jobs.map((job) => job.key)), now)

  const linked = jobs.map((job): JobRecord => {
    const known = seen[job.key]
    if (known) return { ...job, firstSeenAt: known.firstSeenAt, ...(known.repostOf ? { repostOf: known.repostOf } : {}) }

    const earlier = job.textHash === undefined ? undefined : byHash.get(job.textHash)
    return earlier ? { ...job, firstSeenAt: earlier.firstSeenAt, repostOf: earlier.key } : job
  })

  const remembered = Object.entries(seen).filter(([, entry]) => isRecent(entry, now))
  const current = linked.map((job): [string, SeenJob] => {
    const entry: SeenJob = { textHash: job.textHash ?? "", firstSeenAt: job.firstSeenAt, lastSeenAt: nowText }
    return [job.key, job.repostOf ? { ...entry, repostOf: job.repostOf } : entry]
  })
  return { jobs: linked, seen: Object.fromEntries([...remembered, ...current]) }
}

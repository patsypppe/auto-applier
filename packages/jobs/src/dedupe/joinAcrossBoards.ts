// Folds the same posting listed on two of a company's boards (such as "Integra FEC" and "Integra FEC - Internships")
// into one job that keeps every board's link.
import type { JobCopy, JobRecord } from "../types"
import { crossBoardHash } from "./textHash"

// Shorter postings are left alone, because a few generic lines can match on two unrelated boards.
const MIN_TEXT_LENGTH = 300

// Returns the board a job came from.
function boardOf(job: JobRecord): string {
  return `${job.ats}:${job.slug}`
}

// Returns the job's places as one comparable string.
function placesOf(job: JobRecord): string {
  return [...job.locations].sort().join("|")
}

// Returns the job's own links: its copies when it was joined from several, else itself.
function linksOf(job: JobRecord): JobCopy[] {
  return job.copies ?? [{ id: job.id, url: job.url, locations: job.locations }]
}

// Returns the jobs with each cross-board duplicate folded into the job on the first board, by name, at the same places.
// Same-text openings on one board are separate openings and stay apart. The order of the remaining jobs is kept.
export function joinAcrossBoards(jobs: readonly JobRecord[]): JobRecord[] {
  const groups = new Map<string, JobRecord[]>()
  for (const job of jobs) {
    if (job.description.length < MIN_TEXT_LENGTH) continue
    const hash = crossBoardHash(job)
    groups.set(hash, [...(groups.get(hash) ?? []), job])
  }

  const replaced = new Map<string, JobRecord>()
  const folded = new Set<string>()
  for (const group of groups.values()) {
    const boards = [...new Set(group.map(boardOf))].sort()
    if (boards.length < 2) continue

    const kept = group.filter((job) => boardOf(job) === boards[0])
    for (const other of group.filter((job) => boardOf(job) !== boards[0])) {
      const target = kept.find((job) => placesOf(job) === placesOf(other))
      if (!target) continue
      const current = replaced.get(target.key) ?? target
      replaced.set(target.key, { ...current, copies: [...linksOf(current), ...linksOf(other)] })
      folded.add(other.key)
    }
  }

  return jobs.filter((job) => !folded.has(job.key)).map((job) => replaced.get(job.key) ?? job)
}

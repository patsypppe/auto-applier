// Remembers boards that returned 404, so a board gone on two different days is skipped by later runs.
import type { BoardResult } from "../fetching/collectBoards"
import type { Ats } from "../types"

export type DeadBoards = Record<string, { first404: string; last404: string }>

// Returns true when the board returned 404 on at least two different days and has not worked since.
export function isDead(dead: DeadBoards, ats: Ats, slug: string): boolean {
  const entry = dead[`${ats}:${slug}`]
  return entry !== undefined && entry.first404 !== entry.last404
}

// Records this run's 404s by date and forgets boards that worked; other failures, like a busy server, change nothing.
export function updateDeadBoards(previous: DeadBoards, results: readonly BoardResult[], today: string): DeadBoards {
  const next = { ...previous }
  for (const result of results) {
    const key = `${result.ats}:${result.slug}`
    if (result.outcome !== "failed") delete next[key]
    else if (result.status === 404) next[key] = { first404: next[key]?.first404 ?? today, last404: today }
  }
  return next
}

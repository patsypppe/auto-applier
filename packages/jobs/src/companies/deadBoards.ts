// Remembers boards that returned 404, so a board still gone after most of a day is skipped by later runs.
import type { BoardResult } from "../fetching/collectBoards"
import { boardKey } from "../boardKey"
import type { Board } from "../types"

// Times rather than calendar dates, because two runs a few hours apart can fall on different UTC dates.
const DEAD_AFTER_HOURS = 20

export type DeadBoards = Record<string, { first404: string; last404: string }>

// Returns true when the board returned 404 twice at least DEAD_AFTER_HOURS apart and has not worked since.
export function isDead(dead: DeadBoards, board: Pick<Board, "ats" | "slug" | "region">): boolean {
  const entry = dead[boardKey(board)]
  if (entry === undefined) return false
  return Date.parse(entry.last404) - Date.parse(entry.first404) >= DEAD_AFTER_HOURS * 3_600_000
}

// Records this run's 404s with the run's time and forgets boards that worked; other failures, like a busy server, change nothing.
export function updateDeadBoards(previous: DeadBoards, results: readonly BoardResult[], now: Date): DeadBoards {
  const at = now.toISOString()
  const next = { ...previous }
  for (const result of results) {
    const key = boardKey(result)
    if (result.outcome !== "failed") delete next[key]
    else if (result.status === 404) next[key] = { first404: next[key]?.first404 ?? at, last404: at }
  }
  return next
}

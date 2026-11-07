// Names a board's site and slug in one place, with "lever-eu" for Lever's EU boards, so a US and an EU board with the same
// slug never share a cache file, a list entry or a dead mark.
import type { Board } from "./types"

// Returns the board's site: its job site, or "lever-eu" for a Lever board in the EU.
export function siteOf(board: Pick<Board, "ats" | "region">): string {
  return board.region === "eu" ? `${board.ats}-eu` : board.ats
}

// Returns the key that names one board, such as "greenhouse:stripe" or "lever-eu:cirrus".
export function boardKey(board: Pick<Board, "ats" | "slug" | "region">): string {
  return `${siteOf(board)}:${board.slug}`
}

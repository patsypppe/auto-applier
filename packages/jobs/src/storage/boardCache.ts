// Saves each board's raw answer on disk with the time it was fetched, so a second run the same day can skip the request.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { siteOf } from "../boardKey"
import type { Board } from "../types"

type CachedBoard = { fetchedAt: string; raw: unknown }

type BoardName = Pick<Board, "ats" | "slug" | "region">

// Returns the file for one board, in a folder per site (lever-eu apart from lever); the slug is encoded so it can never
// point outside that folder.
function cacheFile(dir: string, board: BoardName): string {
  return join(dir, siteOf(board), `${encodeURIComponent(board.slug)}.json`)
}

// Returns the saved answer when it is younger than maxAgeHours, or undefined when it is old, missing or unreadable.
export async function readCachedBoard(
  dir: string,
  board: BoardName,
  maxAgeHours: number,
  now: Date,
): Promise<unknown> {
  try {
    const cached = JSON.parse(await readFile(cacheFile(dir, board), "utf8")) as CachedBoard
    const ageMs = now.getTime() - new Date(cached.fetchedAt).getTime()
    return ageMs < maxAgeHours * 3_600_000 ? cached.raw : undefined
  } catch {
    return undefined
  }
}

// Saves a board's raw answer with the time it was fetched.
export async function writeCachedBoard(dir: string, board: BoardName, raw: unknown, now: Date): Promise<void> {
  await mkdir(join(dir, siteOf(board)), { recursive: true })
  const cached: CachedBoard = { fetchedAt: now.toISOString(), raw }
  await writeFile(cacheFile(dir, board), JSON.stringify(cached))
}

// Saves each board's raw answer on disk with the time it was fetched, so a second run the same day can skip the request.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Ats } from "../types"

type CachedBoard = { fetchedAt: string; raw: unknown }

// Returns the file for one board; the slug is encoded so it can never point outside the job site's folder.
function cacheFile(dir: string, ats: Ats, slug: string): string {
  return join(dir, ats, `${encodeURIComponent(slug)}.json`)
}

// Returns the saved answer when it is younger than maxAgeHours, or undefined when it is old, missing or unreadable.
export async function readCachedBoard(
  dir: string,
  ats: Ats,
  slug: string,
  maxAgeHours: number,
  now: Date,
): Promise<unknown> {
  try {
    const cached = JSON.parse(await readFile(cacheFile(dir, ats, slug), "utf8")) as CachedBoard
    const ageMs = now.getTime() - new Date(cached.fetchedAt).getTime()
    return ageMs < maxAgeHours * 3_600_000 ? cached.raw : undefined
  } catch {
    return undefined
  }
}

// Saves a board's raw answer with the time it was fetched.
export async function writeCachedBoard(dir: string, ats: Ats, slug: string, raw: unknown, now: Date): Promise<void> {
  await mkdir(join(dir, ats), { recursive: true })
  const cached: CachedBoard = { fetchedAt: now.toISOString(), raw }
  await writeFile(cacheFile(dir, ats, slug), JSON.stringify(cached))
}

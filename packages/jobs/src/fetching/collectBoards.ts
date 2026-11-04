// Reads many boards: one request at a time per job site with a pause between requests, different sites side by side.
import { readCachedBoard, writeCachedBoard } from "../storage/boardCache"
import { ashby } from "../sources/ashby"
import { greenhouse } from "../sources/greenhouse"
import { lever } from "../sources/lever"
import type { Ats, BoardSource, GetJson, JobRecord } from "../types"
import { fetchJson } from "./fetchJson"

const SOURCES: Record<Ats, BoardSource> = { greenhouse, lever, ashby }
const DEFAULT_DELAY_MS = 1000

export type BoardResult = {
  ats: Ats
  slug: string
  outcome: "fetched" | "cached" | "failed"
  jobs: number
  error?: string
}

export type CollectOptions = {
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  delayMs?: number
  cache?: { dir: string; maxAgeHours: number }
  now?: Date
}

export type Collected = { jobs: JobRecord[]; results: BoardResult[] }

// Waits for the given number of milliseconds.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Builds the request function for one job site: every request after the first waits the pause before it goes out.
function politeGetJson(source: BoardSource, options: CollectOptions, sleep: (ms: number) => Promise<void>) {
  let first = true
  return (slug: string): GetJson =>
    async (url, body) => {
      if (!first) await sleep(options.delayMs ?? DEFAULT_DELAY_MS)
      first = false
      return fetchJson(url, { label: `${source.name} board '${slug}'`, body, fetchFn: options.fetchFn, sleep })
    }
}

// Reads one board from the cache or the network and returns its jobs and how it went.
async function collectBoard(
  source: BoardSource,
  slug: string,
  getJsonFor: (slug: string) => GetJson,
  options: CollectOptions,
  now: Date,
): Promise<{ jobs: JobRecord[]; result: BoardResult }> {
  const { cache } = options
  try {
    const cached = cache ? await readCachedBoard(cache.dir, source.ats, slug, cache.maxAgeHours, now) : undefined
    const raw = cached ?? (await source.fetchRaw(slug, getJsonFor(slug)))
    if (cache && cached === undefined) await writeCachedBoard(cache.dir, source.ats, slug, raw, now)

    const jobs = source.readJobs(raw, slug, now.toISOString())
    const outcome = cached === undefined ? "fetched" : "cached"
    return { jobs, result: { ats: source.ats, slug, outcome, jobs: jobs.length } }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { jobs: [], result: { ats: source.ats, slug, outcome: "failed", jobs: 0, error: message } }
  }
}

// Reads the given boards of one job site in order; a board that fails is recorded and the rest still run.
export async function collectBoards(source: BoardSource, slugs: readonly string[], options: CollectOptions = {}): Promise<Collected> {
  const now = options.now ?? new Date()
  const getJsonFor = politeGetJson(source, options, options.sleep ?? wait)

  const jobs: JobRecord[] = []
  const results: BoardResult[] = []
  for (const slug of slugs) {
    const board = await collectBoard(source, slug, getJsonFor, options, now)
    jobs.push(...board.jobs)
    results.push(board.result)
  }
  return { jobs, results }
}

// Reads boards from every job site at once, since they are different hosts, and joins the results.
export async function collectAll(boards: readonly { ats: Ats; slug: string }[], options: CollectOptions = {}): Promise<Collected> {
  const sites = [...new Set(boards.map((board) => board.ats))]
  const collected = await Promise.all(
    sites.map((ats) =>
      collectBoards(
        SOURCES[ats],
        boards.filter((board) => board.ats === ats).map((board) => board.slug),
        options,
      ),
    ),
  )
  return {
    jobs: collected.flatMap((site) => site.jobs),
    results: collected.flatMap((site) => site.results),
  }
}

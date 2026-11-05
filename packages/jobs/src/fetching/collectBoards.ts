// Reads many boards: one request at a time per job site with a pause between requests, different sites side by side.
import { readCachedBoard, writeCachedBoard } from "../storage/boardCache"
import { ashby } from "../sources/ashby"
import { greenhouse } from "../sources/greenhouse"
import { lever } from "../sources/lever"
import { workday } from "../sources/workday"
import type { Ats, Board, BoardSearch, BoardSource, GetJson, JobRecord } from "../types"
import { fetchJson, RequestError } from "./fetchJson"

const SOURCES: Record<Ats, BoardSource> = { greenhouse, lever, ashby, workday }
const DEFAULT_DELAY_MS = 1000
const GIVE_UP_AFTER = 5

export type BoardToRead = Board & { name?: string }

export type BoardResult = {
  ats: Ats
  slug: string
  outcome: "fetched" | "cached" | "failed"
  jobs: number
  status?: number
  error?: string
}

export type CollectOptions = {
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  delayMs?: number
  cache?: { dir: string; maxAgeHours: number }
  now?: Date
  onBoard?: (result: BoardResult, done: number, total: number) => void
  onRequest?: (url: string, at: Date) => void
  search?: BoardSearch
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
      options.onRequest?.(url, new Date())
      return fetchJson(url, { label: `${source.name} board '${slug}'`, body, fetchFn: options.fetchFn, sleep })
    }
}

// Gives jobs the company's name from the list when the board only told us its slug, as Lever and Ashby do.
function withCompanyName(jobs: JobRecord[], board: BoardToRead): JobRecord[] {
  const { name } = board
  if (!name) return jobs
  return jobs.map((job) => (job.company === board.slug ? { ...job, company: name } : job))
}

// Reads one board from the cache or the network and returns its jobs and how it went.
async function collectBoard(
  source: BoardSource,
  board: BoardToRead,
  getJsonFor: (slug: string) => GetJson,
  options: CollectOptions,
  now: Date,
): Promise<{ jobs: JobRecord[]; result: BoardResult }> {
  const { cache } = options
  const { slug } = board
  try {
    const cached = cache ? await readCachedBoard(cache.dir, source.ats, slug, cache.maxAgeHours, now) : undefined
    const raw = cached ?? (await source.fetchRaw(board, getJsonFor(slug), options.search))
    if (cache && cached === undefined) await writeCachedBoard(cache.dir, source.ats, slug, raw, now)

    const jobs = withCompanyName(source.readJobs(raw, slug, now.toISOString()), board)
    const outcome = cached === undefined ? "fetched" : "cached"
    return { jobs, result: { ats: source.ats, slug, outcome, jobs: jobs.length } }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const status = error instanceof RequestError ? error.status : undefined
    const failed: BoardResult = { ats: source.ats, slug, outcome: "failed", jobs: 0, error: message }
    return { jobs: [], result: status === undefined ? failed : { ...failed, status } }
  }
}

// Records a board that was not asked because its site stopped answering.
function skipped(source: BoardSource, slug: string): BoardResult {
  const error = `Skipped: ${source.name} could not be reached for ${GIVE_UP_AFTER} boards in a row.`
  return { ats: source.ats, slug, outcome: "failed", jobs: 0, error }
}

// Reads the given boards of one job site in order; a board that fails is recorded and the rest still run.
export async function collectBoards(
  source: BoardSource,
  boards: readonly BoardToRead[],
  options: CollectOptions = {},
): Promise<Collected> {
  const now = options.now ?? new Date()
  const getJsonFor = politeGetJson(source, options, options.sleep ?? wait)

  const jobs: JobRecord[] = []
  const results: BoardResult[] = []
  let unreachableInARow = 0
  for (const board of boards) {
    // After several boards in a row with no answer at all, the site or the network is down, so the rest are skipped.
    const collected =
      unreachableInARow >= GIVE_UP_AFTER
        ? { jobs: [], result: skipped(source, board.slug) }
        : await collectBoard(source, board, getJsonFor, options, now)
    const unreachable = collected.result.outcome === "failed" && collected.result.status === undefined
    unreachableInARow = unreachable ? unreachableInARow + 1 : 0

    jobs.push(...collected.jobs)
    results.push(collected.result)
    options.onBoard?.(collected.result, results.length, boards.length)
  }
  return { jobs, results }
}

// Reads boards from every job site at once, since they are different hosts, and joins the results.
export async function collectAll(boards: readonly BoardToRead[], options: CollectOptions = {}): Promise<Collected> {
  const sites = [...new Set(boards.map((board) => board.ats))]
  const collected = await Promise.all(
    sites.map((ats) => collectBoards(SOURCES[ats], boards.filter((board) => board.ats === ats), options)),
  )
  return {
    jobs: collected.flatMap((site) => site.jobs),
    results: collected.flatMap((site) => site.results),
  }
}

// The "collect" command: reads every board in data/companies.json into data/jobs.jsonl, or the boards named with --board
// into data/jobs.boards.jsonl.
import { appendFile } from "node:fs/promises"
import { join } from "node:path"
import { readBoardArgs } from "../boardArg"
import { isDead, updateDeadBoards, type DeadBoards } from "../companies/deadBoards"
import { linkReposts, type SeenJobs } from "../dedupe/linkReposts"
import { mergeCopies } from "../dedupe/mergeCopies"
import { collectAll, type BoardResult, type BoardToRead, type CollectOptions } from "../fetching/collectBoards"
import { brokenRunReason } from "../fetching/runHealth"
import { formatSummary } from "../fetching/summary"
import { readCompanyFile, readJsonFile, writeJobsFile, writeJsonFile } from "../storage/files"

const CACHE_HOURS = 12
const PROGRESS_EVERY = 25

export type CollectCommandOptions = Pick<CollectOptions, "fetchFn" | "sleep">

// Returns true when the arguments name boards with --board.
function namesBoards(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--board" || arg.startsWith("--board="))
}

// Picks the boards to read: the ones named with --board, or every company in the list whose board is not dead.
async function boardsToRead(args: readonly string[], dataDir: string, dead: DeadBoards): Promise<{ boards: BoardToRead[]; skipped: number }> {
  if (namesBoards(args)) return { boards: readBoardArgs(args), skipped: 0 }

  const companies = await readCompanyFile(join(dataDir, "companies.json"))
  const boards = companies.filter((company) => !isDead(dead, company.ats, company.slug))
  return { boards, skipped: companies.length - boards.length }
}

// Prints a progress line every few boards, and when a job site finishes.
function progressPrinter(print: (line: string) => void) {
  return (result: BoardResult, done: number, total: number) => {
    if (done % PROGRESS_EVERY === 0 || done === total) print(`  ${result.ats}: ${done} of ${total} boards`)
  }
}

// Collects the boards, joins copies and links reposts, and saves the jobs. A run where most boards failed keeps the
// earlier feed. The requests made and the boards that returned 404 are saved either way.
export async function runCollect(
  args: readonly string[],
  dataDir: string,
  print: (line: string) => void,
  options: CollectCommandOptions = {},
): Promise<void> {
  const deadFile = join(dataDir, "dead-boards.json")
  const dead = await readJsonFile<DeadBoards>(deadFile, {})
  const { boards, skipped } = await boardsToRead(args, dataDir, dead)
  if (skipped > 0) print(`Skipping ${skipped} boards that returned 404 twice, at least 20 hours apart (see ${deadFile}).`)

  const requests: string[] = []
  const started = new Date()
  const { jobs, results } = await collectAll(boards, {
    ...options,
    cache: { dir: join(dataDir, "cache"), maxAgeHours: args.includes("--fresh") ? 0 : CACHE_HOURS },
    onBoard: progressPrinter(print),
    onRequest: (url, at) => requests.push(`${at.toISOString()} ${new URL(url).host}\n`),
  })
  await appendFile(join(dataDir, "requests.log"), requests.join(""))
  await writeJsonFile(deadFile, updateDeadBoards(dead, results, started))
  print(formatSummary(results, (Date.now() - started.getTime()) / 1000))

  const broken = brokenRunReason(results)
  if (broken) throw new Error(broken)

  const seenFile = join(dataDir, "seen.json")
  const merged = mergeCopies(jobs)
  const linked = linkReposts(merged, await readJsonFile<SeenJobs>(seenFile, {}), started)
  const reposts = linked.jobs.filter((job) => job.repostOf !== undefined).length

  // A few boards named by hand are a trial: they go to their own file and are not remembered as seen.
  const file = join(dataDir, namesBoards(args) ? "jobs.boards.jsonl" : "jobs.jsonl")
  await writeJobsFile(file, linked.jobs)
  if (!namesBoards(args)) await writeJsonFile(seenFile, linked.seen)

  print(`${jobs.length.toLocaleString("en-US")} postings became ${merged.length.toLocaleString("en-US")} jobs after joining copies; ${reposts} reposts linked to an earlier copy.`)
  print(`Saved to ${file}`)
}

// The "collect" command: reads every board in data/companies.json, or the boards named with --board, into data/jobs.jsonl.
import { appendFile } from "node:fs/promises"
import { join } from "node:path"
import { readBoardArgs } from "../boardArg"
import { isDead, updateDeadBoards, type DeadBoards } from "../companies/deadBoards"
import { collectAll, type BoardResult, type BoardToRead } from "../fetching/collectBoards"
import { formatSummary } from "../fetching/summary"
import { readCompanyFile, readJsonFile, writeJobsFile, writeJsonFile } from "../storage/files"

const CACHE_HOURS = 12
const PROGRESS_EVERY = 25

// Picks the boards to read: the ones named with --board, or every company in the list whose board is not dead.
async function boardsToRead(args: readonly string[], dataDir: string, dead: DeadBoards): Promise<{ boards: BoardToRead[]; skipped: number }> {
  if (args.some((arg) => arg === "--board" || arg.startsWith("--board="))) return { boards: readBoardArgs(args), skipped: 0 }

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

// Collects the boards, saves the jobs, the requests made and the boards that returned 404, and prints the summary.
export async function runCollect(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const deadFile = join(dataDir, "dead-boards.json")
  const dead = await readJsonFile<DeadBoards>(deadFile, {})
  const { boards, skipped } = await boardsToRead(args, dataDir, dead)
  if (skipped > 0) print(`Skipping ${skipped} boards that returned 404 on two different days (see ${deadFile}).`)

  const requestLog = join(dataDir, "requests.log")
  const started = new Date()
  const { jobs, results } = await collectAll(boards, {
    cache: { dir: join(dataDir, "cache"), maxAgeHours: args.includes("--fresh") ? 0 : CACHE_HOURS },
    onBoard: progressPrinter(print),
    onRequest: (url, at) => void appendFile(requestLog, `${at.toISOString()} ${new URL(url).host}\n`),
  })

  const file = join(dataDir, "jobs.jsonl")
  await writeJobsFile(file, jobs)
  await writeJsonFile(deadFile, updateDeadBoards(dead, results, started.toISOString().slice(0, 10)))

  print(formatSummary(results, (Date.now() - started.getTime()) / 1000))
  print(`Saved to ${file}`)
}

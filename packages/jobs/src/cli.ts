// Command line entry point: "collect --board site:slug [--board ...] [--fresh]" reads boards into data/jobs.json.
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { readBoardArgs } from "./boardArg"
import { collectAll } from "./fetching/collectBoards"
import { formatSummary } from "./fetching/summary"

const DATA_DIR = join(process.cwd(), "data")
const CACHE_HOURS = 12

// Collects the chosen boards, saves the jobs and prints the summary; --fresh ignores saved answers.
async function collect(args: readonly string[]): Promise<void> {
  const boards = readBoardArgs(args)
  const fresh = args.includes("--fresh")
  const started = Date.now()

  const { jobs, results } = await collectAll(boards, {
    cache: { dir: join(DATA_DIR, "cache"), maxAgeHours: fresh ? 0 : CACHE_HOURS },
  })

  await mkdir(DATA_DIR, { recursive: true })
  const file = join(DATA_DIR, "jobs.json")
  await writeFile(file, JSON.stringify(jobs))

  process.stdout.write(`${formatSummary(results, (Date.now() - started) / 1000)}\nSaved to ${file}\n`)
}

// Runs the command named in the arguments and prints any error as one line.
async function main(argv: readonly string[]): Promise<void> {
  const [command, ...args] = argv
  if (command !== "collect") throw new Error(`Unknown command '${command ?? ""}'. Try: collect --board greenhouse:stripe`)
  await collect(args)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

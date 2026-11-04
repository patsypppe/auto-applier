// Command line entry point: "collect --board greenhouse:<slug>" reads one board and saves its jobs to data/jobs.json.
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { readBoardArg } from "./boardArg"
import { fetchGreenhouseBoard } from "./sources/greenhouse"

const DATA_DIR = join(process.cwd(), "data")

// Collects the chosen board, saves the jobs and prints how many were found and how long it took.
async function collect(args: readonly string[]): Promise<void> {
  const { slug } = readBoardArg(args)
  const started = Date.now()

  const jobs = await fetchGreenhouseBoard(slug)

  await mkdir(DATA_DIR, { recursive: true })
  const file = join(DATA_DIR, "jobs.json")
  await writeFile(file, JSON.stringify(jobs))

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const inUs = jobs.filter((job) => job.country === "US").length
  process.stdout.write(`Greenhouse '${slug}': ${jobs.length} jobs (${inUs} in the US) in ${seconds} s. Saved to ${file}\n`)
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

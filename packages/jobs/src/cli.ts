// Command line entry point for the job feed: "companies" builds the company list, "collect" reads the boards, "tags" checks
// the work-authorization tags, "top" prints the best jobs for the user, "feed" serves the feed page, and "export-applied"
// writes the application history to a CSV file. "h1b" builds the H-1B history from a USCIS download. "labelled" scores the
// readers against the hand-labelled postings. "measure" times the feed's start and settings save and its peak memory.
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { runCollect } from "./commands/collect"
import { runCompanies } from "./commands/companies"
import { runExportApplied } from "./commands/exportApplied"
import { runFeed } from "./commands/feed"
import { runH1b } from "./commands/h1b"
import { runLabelled } from "./commands/labelled"
import { runMeasure } from "./commands/measure"
import { runTags } from "./commands/tags"
import { runTop } from "./commands/top"

// The data folder sits next to dist/, inside the package, wherever the command is run from, so git always ignores it.
const DATA_DIR = fileURLToPath(new URL("../data", import.meta.url))
const LABELLED_FILE = fileURLToPath(new URL("../test/fixtures/labelled-jobs.json", import.meta.url))
const USAGE = "Commands: companies [--with-aggregator], collect [--board site:slug ...] [--fresh], tags [--status f1-opt], top [--limit 20], feed [--port 4317], export-applied, h1b [--file path], labelled [--misses], measure [--runs 5]"

// Writes one line to the terminal.
function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

// Runs the command named in the arguments.
async function main(argv: readonly string[]): Promise<void> {
  const [command, ...args] = argv
  await mkdir(DATA_DIR, { recursive: true })

  if (command === "companies") return runCompanies(args, DATA_DIR, print)
  if (command === "collect") return runCollect(args, DATA_DIR, print)
  if (command === "tags") return runTags(args, DATA_DIR, print)
  if (command === "top") return runTop(args, DATA_DIR, print)
  if (command === "feed") return runFeed(args, DATA_DIR, print)
  if (command === "export-applied") return runExportApplied(DATA_DIR, print)
  if (command === "h1b") return runH1b(args, DATA_DIR, print)
  if (command === "labelled") return runLabelled(args, LABELLED_FILE, print)
  if (command === "measure") return runMeasure(args, DATA_DIR, print)
  throw new Error(`Unknown command '${command ?? ""}'. ${USAGE}`)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

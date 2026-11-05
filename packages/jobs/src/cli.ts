// Command line entry point for the job feed: "companies" builds the company list, "collect" reads the boards.
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { runCollect } from "./commands/collect"
import { runCompanies } from "./commands/companies"

// The data folder sits next to dist/, inside the package, wherever the command is run from, so git always ignores it.
const DATA_DIR = fileURLToPath(new URL("../data", import.meta.url))
const USAGE = "Commands: companies [--with-aggregator], collect [--board site:slug ...] [--fresh]"

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
  throw new Error(`Unknown command '${command ?? ""}'. ${USAGE}`)
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

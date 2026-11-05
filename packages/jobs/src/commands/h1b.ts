// The "h1b" command: adds up a downloaded USCIS H-1B Employer Data Hub file into data/h1b.json, then reports how many of
// the collected companies it could match and lists the rest in data/h1b-unmatched.txt, so aliases are easy to add.
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { matchEmployer } from "../history/matchEmployer"
import { readH1bCsv } from "../history/readH1bCsv"
import { eachJob, readJsonFile, writeJsonFile } from "../storage/files"

const DEFAULT_FILE = "h1b/h1b-employers-fy2026.csv"

// Reads the file named with --file, or the default one in the data folder.
function fileFrom(args: readonly string[], dataDir: string): string {
  const index = args.indexOf("--file")
  return index === -1 ? join(dataDir, DEFAULT_FILE) : (args[index + 1] ?? "")
}

// Builds data/h1b.json and prints the match rate over companies that have at least one job in the US or with no country.
export async function runH1b(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const history = await readH1bCsv(fileFrom(args, dataDir))
  await writeJsonFile(join(dataDir, "h1b.json"), history)
  print(`FY${history.fiscalYear}: ${Object.keys(history.employers).length.toLocaleString("en-US")} employer names. Saved to ${join(dataDir, "h1b.json")}`)

  const companies = new Set<string>()
  await eachJob(join(dataDir, "jobs.jsonl"), (job) => {
    if (job.country !== "other") companies.add(job.company)
  })
  const aliases = await readJsonFile<Record<string, string>>(join(dataDir, "aliases.json"), {})
  const results = [...companies].sort().map((company) => ({ company, found: matchEmployer(company, history, aliases) }))

  const count = (test: (found: (typeof results)[number]["found"]) => boolean) => results.filter(({ found }) => test(found)).length
  const matched = count((found) => found.status === "matched")
  print(`${companies.size} companies with US jobs: ${matched} matched (${Math.round((100 * matched) / Math.max(1, companies.size))}%).`)
  for (const how of ["alias", "exact", "generic-ending"] as const) print(`  ${how}: ${count((found) => found.status === "matched" && found.how === how)}`)
  print(`  ambiguous: ${count((found) => found.status === "ambiguous")}, no filings found: ${count((found) => found.status === "none")}`)

  const unmatched = results.filter(({ found }) => found.status !== "matched").map(({ company, found }) => `${company}\t${found.status}`)
  await writeFile(join(dataDir, "h1b-unmatched.txt"), `${unmatched.join("\n")}\n`)
  print(`Unmatched names listed in ${join(dataDir, "h1b-unmatched.txt")}; add aliases to data/aliases.json as {"Board name": "USCIS NAME"}.`)
}

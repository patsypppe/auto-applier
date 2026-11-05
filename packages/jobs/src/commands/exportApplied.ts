// The "export-applied" command: writes the application history in data/applied.json to data/applied.csv for a spreadsheet.
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { AppliedEntry } from "../feed/applied"
import { readJsonFile } from "../storage/files"

const HEADER = "company,title,status,first date,latest date,note,link"

// Quotes a cell when it holds a comma, quote or line break, and puts a ' before a leading = + - or @ so a spreadsheet
// does not run it as a formula.
function cell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

// Turns the history into CSV text: a header, then one row per job with its first and latest status dates.
export function toCsv(history: readonly AppliedEntry[]): string {
  const rows = history.map((entry) => {
    const dates = entry.changes.map((change) => change.date.slice(0, 10))
    return [entry.company, entry.title, entry.status, dates[0] ?? "", dates.at(-1) ?? "", entry.note ?? "", entry.url].map(cell).join(",")
  })
  return [HEADER, ...rows].join("\n") + "\n"
}

// Reads the history and writes the CSV next to it.
export async function runExportApplied(dataDir: string, print: (line: string) => void): Promise<void> {
  const history = await readJsonFile<AppliedEntry[]>(join(dataDir, "applied.json"), [])
  const file = join(dataDir, "applied.csv")
  await writeFile(file, toCsv(history))
  print(`Wrote ${history.length} tracked jobs to ${file}`)
}

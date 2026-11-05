// Reads the CSV that the USCIS H-1B Employer Data Hub's crosstab view downloads, and adds it up per employer name.
import { createReadStream } from "node:fs"
import { normalizeName } from "./normalizeName"

export type EmployerFilings = { name: string; approvals: number; newEmploymentApprovals: number; denials: number }
export type H1bHistory = { fiscalYear: number; employers: Record<string, EmployerFilings> }

const COLUMNS = { name: "Employer (Petitioner) Name", year: "Fiscal Year", measure: "Measure Names", value: "Measure Values" } as const

// Splits one CSV line into cells, handling quoted cells such as "1,234" and doubled quotes inside them.
function cells(line: string): string[] {
  const found: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!
    if (quoted && char === '"' && line[i + 1] === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      found.push(current)
      current = ""
    } else {
      current += char
    }
  }
  return [...found, current]
}

// Yields the file's lines one at a time without a byte-order mark or carriage returns.
async function* linesOf(file: string): AsyncGenerator<string> {
  let rest = ""
  for await (const chunk of createReadStream(file, "utf8")) {
    const lines = (rest + String(chunk)).split("\n")
    rest = lines.pop() ?? ""
    yield* lines.map((line) => line.replace(/\r$/, ""))
  }
  if (rest !== "") yield rest
}

// Adds up the file: all approval measures, new employment approvals on their own, and all denials, per normalized name.
// Names that normalize the same (STRIPE LLC, STRIPE INC) are joined and shown by the one with the most approvals.
export async function readH1bCsv(file: string): Promise<H1bHistory> {
  const totals = new Map<string, Omit<EmployerFilings, "name">>()
  const approvalsByName = new Map<string, Map<string, number>>()
  let index: Record<keyof typeof COLUMNS, number> | undefined
  let fiscalYear = 0

  for await (const line of linesOf(file)) {
    const row = cells(line.replace(/^\ufeff/, ""))
    if (!index) {
      const header = row.map((cell) => cell.trim())
      const missing = Object.values(COLUMNS).find((column) => !header.includes(column))
      if (missing) throw new Error(`${file} does not look like a USCIS H-1B Employer Data Hub file: it has no "${missing}" column.`)
      index = { name: header.indexOf(COLUMNS.name), year: header.indexOf(COLUMNS.year), measure: header.indexOf(COLUMNS.measure), value: header.indexOf(COLUMNS.value) }
      continue
    }

    const name = (row[index.name] ?? "").trim()
    if (name === "") continue
    const key = normalizeName(name)
    const measure = row[index.measure] ?? ""
    const value = Number((row[index.value] ?? "0").replaceAll(",", "")) || 0
    const approval = measure.endsWith("Approval") ? value : 0
    fiscalYear = Math.max(fiscalYear, Number(row[index.year]) || 0)

    const total = totals.get(key) ?? { approvals: 0, newEmploymentApprovals: 0, denials: 0 }
    totals.set(key, {
      approvals: total.approvals + approval,
      newEmploymentApprovals: total.newEmploymentApprovals + (measure === "New Employment Approval" ? value : 0),
      denials: total.denials + (measure.endsWith("Denial") ? value : 0),
    })
    const names = approvalsByName.get(key) ?? new Map<string, number>()
    approvalsByName.set(key, names.set(name, (names.get(name) ?? 0) + approval))
  }

  if (!index) throw new Error(`${file} is empty.`)
  const employers = Object.fromEntries(
    [...totals].map(([key, total]) => {
      const [name] = [...approvalsByName.get(key)!].reduce((best, next) => (next[1] > best[1] ? next : best))
      return [key, { name, ...total }]
    }),
  )
  return { fiscalYear, employers }
}

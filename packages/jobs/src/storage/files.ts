// Reads and writes the job feed's files in data/: the collected jobs, one per line, and the company lists.
import { createReadStream } from "node:fs"
import { open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { createInterface } from "node:readline"
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import type { Company, JobRecord } from "../types"

z.config(en())

const companySchema = z.object({
  name: z.optional(z.string()),
  ats: z.enum(["greenhouse", "lever", "ashby"]),
  slug: z.string().check(z.minLength(1)),
  region: z.optional(z.literal("eu")),
  sources: z.optional(z.array(z.string())),
})

// Returns true when the error says the file does not exist.
function isMissing(error: unknown): boolean {
  return (error as { code?: string }).code === "ENOENT"
}

// Reads a JSON file, or returns the fallback when the file does not exist yet.
export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T
  } catch (error: unknown) {
    if (isMissing(error)) return fallback
    throw error
  }
}

// Writes a value as indented JSON, so the file is easy to read and edit by hand, replacing the old file only when done.
export async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`)
  await rename(`${file}.tmp`, file)
}

// Writes the jobs one JSON object per line, so a large collection never has to fit in one string.
// The lines go to a temporary file that replaces the old one only once it is complete, so a crash never leaves half a feed.
export async function writeJobsFile(file: string, jobs: readonly JobRecord[]): Promise<void> {
  const temporary = `${file}.tmp`
  const handle = await open(temporary, "w")
  try {
    for (const job of jobs) await handle.write(`${JSON.stringify(job)}\n`)
  } catch (error: unknown) {
    await handle.close()
    await rm(temporary, { force: true })
    throw error
  }
  await handle.close()
  await rename(temporary, file)
}

// Reads the jobs written by writeJobsFile one at a time, so a large feed never has to be in memory at once.
// A file that does not exist yet means no jobs.
export async function eachJob(file: string, visit: (job: JobRecord) => void): Promise<void> {
  try {
    const lines = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity })
    for await (const line of lines) if (line.trim() !== "") visit(JSON.parse(line) as JobRecord)
  } catch (error: unknown) {
    if (!isMissing(error)) throw error
  }
}

// Reads every job written by writeJobsFile into a list.
export async function readJobsFile(file: string): Promise<JobRecord[]> {
  const jobs: JobRecord[] = []
  await eachJob(file, (job) => jobs.push(job))
  return jobs
}

// Turns a schema problem into "ats must be one of ..." style text.
function describeIssue(issue: z.core.$ZodIssue): string {
  const field = issue.path.join(".")
  if (issue.code === "invalid_value" && field === "ats") return "ats must be one of greenhouse, lever, ashby."
  return `${field}: ${issue.message}.`
}

// Reads a list of companies; hand-written entries may leave out the name and sources, which default to the slug and the given source.
export async function readCompanyFile(
  file: string,
  options: { optional?: boolean; source?: string } = {},
): Promise<Company[]> {
  let text: string
  try {
    text = await readFile(file, "utf8")
  } catch (error: unknown) {
    if (!isMissing(error)) throw error
    if (options.optional) return []
    throw new Error(`No company list at ${file}. Run "npm run companies -w @auto-applier/jobs" first.`)
  }

  const entries: unknown = JSON.parse(text)
  if (!Array.isArray(entries)) throw new Error(`${file} must be a list of companies.`)

  return entries.map((entry, index) => {
    const parsed = companySchema.safeParse(entry)
    if (!parsed.success) throw new Error(`${file} entry ${index + 1}: ${describeIssue(parsed.error.issues[0]!)}`)

    const { name, sources, ...board } = parsed.data
    return { name: name?.trim() || board.slug, ...board, sources: sources ?? [options.source ?? file] }
  })
}

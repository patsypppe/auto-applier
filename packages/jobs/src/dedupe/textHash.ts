// Fingerprints a posting by its board, title and text, ignoring what changes between copies: its own city and dates.
import { createHash } from "node:crypto"
import type { JobRecord } from "../types"

// Returns the words of the job's locations ("Austin, TX" gives "austin"), longest first, so they can be taken out of its text.
function placeWords(job: JobRecord): string[] {
  const words = job.locations
    .flatMap((location) => location.split(/[,;/()-]| or /))
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3)
  return [...new Set(words)].sort((a, b) => b.length - a.length)
}

// Dates like 2026-11-04, 11/04/2026 or a bare year. Other numbers stay, because pay and years of experience tell openings apart.
const DATES = /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(19|20)\d{2}\b/g

// Lowercases the text, removes the job's own place names and any dates, and squashes spaces.
function comparableText(job: JobRecord): string {
  let text = job.description.toLowerCase()
  for (const word of placeWords(job)) text = text.split(word).join(" ")
  return text.replace(DATES, " ").replace(/\s+/g, " ").trim()
}

// Returns the title and text in a form that is the same for copies of one posting.
function comparableTitleAndText(job: JobRecord): string {
  return `${job.title.toLowerCase().replace(/\s+/g, " ").trim()}|${comparableText(job)}`
}

// Returns a hash that is the same for copies of one posting listed in several cities or reposted with new dates.
export function textHash(job: JobRecord): string {
  return createHash("sha256").update(`${job.ats}:${job.slug}|${comparableTitleAndText(job)}`).digest("hex")
}

// Returns a hash of the title and text alone, the same for one posting listed on two of a company's boards.
export function crossBoardHash(job: JobRecord): string {
  return createHash("sha256").update(comparableTitleAndText(job)).digest("hex")
}

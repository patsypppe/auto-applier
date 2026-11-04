// Fingerprints a posting by its board, title and text, ignoring what changes between copies: its own city and any numbers.
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

// Lowercases the text, removes the job's own place names and every number, and squashes spaces.
function comparableText(job: JobRecord): string {
  let text = job.description.toLowerCase()
  for (const word of placeWords(job)) text = text.split(word).join(" ")
  return text.replace(/\d+/g, " ").replace(/\s+/g, " ").trim()
}

// Returns a hash that is the same for copies of one posting listed in several cities or reposted with new dates.
export function textHash(job: JobRecord): string {
  const title = job.title.toLowerCase().replace(/\s+/g, " ").trim()
  return createHash("sha256").update(`${job.ats}:${job.slug}|${title}|${comparableText(job)}`).digest("hex")
}

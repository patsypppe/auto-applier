// Joins copies of the same posting listed in several cities into one job with all their locations.
import type { JobRecord } from "../types"
import { textHash } from "./textHash"

// Orders ids the way a person would, so "999" comes before "1000".
function compareIds(a: JobRecord, b: JobRecord): number {
  return a.id.localeCompare(b.id, "en", { numeric: true })
}

// Returns the earliest or latest of the dates that are set.
function pickDate(dates: (string | undefined)[], pick: "earliest" | "latest"): string | undefined {
  const known = dates.filter((date): date is string => date !== undefined).sort((a, b) => Date.parse(a) - Date.parse(b))
  return pick === "earliest" ? known[0] : known[known.length - 1]
}

// Builds one job from its copies: the lowest id names it, so its key stays the same from run to run.
function joinCopies(copies: JobRecord[], hash: string): JobRecord {
  const [first] = [...copies].sort(compareIds)
  const countries = copies.map((copy) => copy.country)
  return {
    ...first!,
    locations: [...new Set(copies.flatMap((copy) => copy.locations))],
    country: countries.includes("US") ? "US" : countries.includes("other") ? "other" : undefined,
    postedAt: pickDate(copies.map((copy) => copy.postedAt), "earliest"),
    updatedAt: pickDate(copies.map((copy) => copy.updatedAt), "latest"),
    textHash: hash,
  }
}

// Groups the jobs by their text hash and returns one job per group, in the order each group first appeared.
export function mergeCopies(jobs: readonly JobRecord[]): JobRecord[] {
  const groups = new Map<string, JobRecord[]>()
  for (const job of jobs) {
    const hash = textHash(job)
    groups.set(hash, [...(groups.get(hash) ?? []), job])
  }
  return [...groups].map(([hash, copies]) => joinCopies(copies, hash))
}

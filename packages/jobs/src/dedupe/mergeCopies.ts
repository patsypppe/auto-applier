// Joins copies of the same posting listed in different cities into one job, keeping each copy's own link.
import type { JobCopy, JobRecord } from "../types"
import { textHash } from "./textHash"

// Orders ids the way a person would, so "999" comes before "1000".
function compareIds(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id, "en", { numeric: true })
}

// Returns the earliest or latest of the dates that are set.
function pickDate(dates: (string | undefined)[], pick: "earliest" | "latest"): string | undefined {
  const known = dates.filter((date): date is string => date !== undefined).sort((a, b) => Date.parse(a) - Date.parse(b))
  return pick === "earliest" ? known[0] : known[known.length - 1]
}

// Splits jobs with the same text into groups whose places do not overlap; two copies at one place are separate openings.
function separateOpenings(jobs: readonly JobRecord[]): JobRecord[][] {
  const groups: { jobs: JobRecord[]; places: Set<string> }[] = []
  for (const job of jobs) {
    const group = groups.find((candidate) => job.locations.every((place) => !candidate.places.has(place)))
    if (group) {
      group.jobs.push(job)
      for (const place of job.locations) group.places.add(place)
    } else {
      groups.push({ jobs: [job], places: new Set(job.locations) })
    }
  }
  return groups.map((group) => group.jobs)
}

// Builds one job from its copies: the lowest id names it, so its key stays the same from run to run.
function joinCopies(copies: JobRecord[], hash: string): JobRecord {
  const sorted = [...copies].sort(compareIds)
  const countries = copies.map((copy) => copy.country)
  const joined: JobRecord = {
    ...sorted[0]!,
    locations: [...new Set(copies.flatMap((copy) => copy.locations))],
    country: countries.includes("US") ? "US" : countries.includes("other") ? "other" : undefined,
    postedAt: pickDate(copies.map((copy) => copy.postedAt), "earliest"),
    updatedAt: pickDate(copies.map((copy) => copy.updatedAt), "latest"),
    textHash: hash,
  }
  if (copies.length === 1) return joined

  const links: JobCopy[] = sorted.map((copy) => ({ id: copy.id, url: copy.url, locations: copy.locations }))
  return { ...joined, copies: links }
}

// Groups the jobs by their text hash and returns one job per opening, in the order each first appeared.
export function mergeCopies(jobs: readonly JobRecord[]): JobRecord[] {
  const byHash = new Map<string, JobRecord[]>()
  for (const job of jobs) {
    const hash = textHash(job)
    byHash.set(hash, [...(byHash.get(hash) ?? []), job])
  }
  return [...byHash].flatMap(([hash, sameText]) => separateOpenings(sameText).map((copies) => joinCopies(copies, hash)))
}

// Writes the few lines printed after a collection: boards and jobs per job site, the failures, and the time taken.
import type { Ats } from "../types"
import type { BoardResult } from "./collectBoards"

const SITE_ORDER: readonly [Ats, string][] = [
  ["greenhouse", "Greenhouse"],
  ["lever", "Lever"],
  ["ashby", "Ashby"],
]

// Returns "1 board" or "3 boards" style text with the number written with commas.
function count(value: number, word: string): string {
  return `${value.toLocaleString("en-US")} ${word}${value === 1 ? "" : "s"}`
}

// Describes one job site's boards, or returns undefined when none of its boards were in the run.
function siteLine(results: readonly BoardResult[], name: string): string | undefined {
  if (results.length === 0) return undefined

  const read = results.filter((result) => result.outcome !== "failed")
  const cached = results.filter((result) => result.outcome === "cached").length
  const jobs = results.reduce((sum, result) => sum + result.jobs, 0)
  const fromCache = cached > 0 ? ` (${cached} from cache)` : ""
  return `${name}: ${read.length} of ${count(results.length, "board")} read${fromCache}, ${count(jobs, "job")}`
}

// Builds the summary of a collection run from its board results and the seconds it took.
export function formatSummary(results: readonly BoardResult[], seconds: number): string {
  const sites = SITE_ORDER.flatMap(([ats, name]) => siteLine(results.filter((result) => result.ats === ats), name) ?? [])
  const failed = results.filter((result) => result.outcome === "failed")
  const failures = failed.length > 0 ? ["Failed:", ...failed.map((result) => `  ${result.ats}:${result.slug}  ${result.error}`)] : []

  return [...sites, ...failures, `Took ${seconds.toFixed(1)} s.`].join("\n")
}

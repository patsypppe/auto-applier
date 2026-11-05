// The "top" command: ranks the collected jobs for the user in data/settings.json and data/profile.json, and prints the best.
import { join } from "node:path"
import { applyFilters, type HideReason } from "../feed/applyFilters"
import { getJobs, type RankedJob } from "../feed/getJobs"
import { historySentence } from "../history/historySentence"
import { loadHistory } from "../history/loadHistory"
import { loadProfile } from "../profile"
import { loadSettings } from "../settings"
import { readJobsFile } from "../storage/files"

const DEFAULT_LIMIT = 20

const EFFECT_WORDS = { blocked: "blocked", "likely-blocked": "likely blocked", ok: "work authorization", positive: "a plus" } as const

// Reads --limit from the arguments, or the default.
function limitFrom(args: readonly string[]): number {
  const index = args.indexOf("--limit")
  const limit = index === -1 ? DEFAULT_LIMIT : Number(args[index + 1])
  if (!Number.isInteger(limit) || limit <= 0) throw new Error("--limit must be a whole number above 0, for example --limit 20.")
  return limit
}

// Counts the hidden jobs by reason, most common first and then by name, so the line reads the same every run.
function hiddenSummary(hidden: readonly { reason: HideReason }[]): string {
  const counts = new Map<HideReason, number>()
  for (const { reason } of hidden) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([reason, count]) => `${reason} ${count.toLocaleString("en-US")}`).join(", ")
}

// Writes one job as a few lines: rank, score, title, company and places, then skills, work authorization and the link.
function describeJob(entry: RankedJob, rank: number): string[] {
  const { job, reasons, tags, effect } = entry
  const places = job.locations.slice(0, 3).join("; ") + (job.locations.length > 3 ? ` and ${job.locations.length - 3} more` : "")
  const missing = reasons.missingSkills.length > 0 ? reasons.missingSkills.join(", ") : "none"
  const evidence = tags.map((found) => (found.evidence ? `${found.tag}: ${found.evidence.slice(0, 160)}` : found.tag)).join(" | ")
  return [
    `${rank}. ${entry.score}  ${job.title} at ${job.company} (${places})`,
    `     you have: ${reasons.matchedSkills.join(", ") || "none named"} | missing: ${missing}${reasons.yearsRequired === undefined ? "" : ` | asks for ${reasons.yearsRequired}+ years`}`,
    `     ${EFFECT_WORDS[effect]}: ${evidence}`,
    ...(entry.history ? [`     ${historySentence(entry.history)}`] : []),
    `     ${job.url}`,
  ]
}

// Ranks the jobs, applies the filters and prints the best ones with a line on what was hidden.
export async function runTop(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const limit = limitFrom(args)
  const settings = await loadSettings(join(dataDir, "settings.json"))
  const profile = await loadProfile(join(dataDir, "profile.json"))
  const jobs = await readJobsFile(join(dataDir, "jobs.jsonl"))

  const { shown, hidden } = applyFilters(getJobs(settings, profile, jobs, await loadHistory(dataDir)), settings)
  const hiddenText = hidden.length > 0 ? ` Hidden: ${hiddenSummary(hidden)}.` : ""
  print(`Showing ${shown.length.toLocaleString("en-US")} of ${jobs.length.toLocaleString("en-US")} jobs.${hiddenText}`)
  shown.slice(0, limit).forEach((entry, index) => describeJob(entry, index + 1).forEach((line) => print(line)))
}

// The "tags" command: tags every collected job, prints how often each tag appears and what that means for one status,
// and writes data/tag-check.json, a fixed sample to check the tags by hand.
import { join } from "node:path"
import { STATUSES } from "../settings"
import { eachJob, writeJsonFile } from "../storage/files"
import { jobEffect } from "../tags/effects"
import { tagJob } from "../tags/tagJob"
import type { AuthTag, Effect, Tag, WorkAuth } from "../types"

const SAMPLE_SIZE = 50

type CheckEntry = { company: string; title: string; url: string; locations: string[]; tags: Pick<Tag, "tag" | "evidence">[] }

// Reads --status from the arguments. Students are taken to need sponsorship later and to have a STEM degree, the
// common case for this tool's users; citizens are taken to be able to obtain a clearance.
export function readWorkAuthArgs(args: readonly string[]): WorkAuth {
  const index = args.indexOf("--status")
  const given = index === -1 ? "f1-opt" : (args[index + 1] ?? "")
  const status = STATUSES.find((name) => name === given)
  if (!status) throw new Error(`Unknown status '${given}'. Use one of: ${STATUSES.join(", ")}.`)

  return {
    status,
    needsSponsorshipLater: status.startsWith("f1-"),
    stemDegree: true,
    clearance: status === "citizen" ? "can-obtain" : "none",
  }
}

// Picks up to n items in a fixed pseudo-random order, so the same feed always gives the same sample to check.
export function pickSample<T>(items: readonly T[], n: number): T[] {
  let seed = 7
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
    return seed / 2_147_483_648
  }
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled.slice(0, n)
}

// Tags the jobs in data/jobs.jsonl that are in the US or have no country, then prints the counts and writes the sample.
export async function runTags(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const auth = readWorkAuthArgs(args)
  const tagCounts = new Map<AuthTag, number>()
  const effectCounts: Record<Effect, number> = { blocked: 0, "likely-blocked": 0, ok: 0, positive: 0 }
  const all: CheckEntry[] = []

  await eachJob(join(dataDir, "jobs.jsonl"), (job) => {
    if (job.country === "other") return
    const tags = tagJob(job)
    for (const { tag } of tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    effectCounts[jobEffect(tags.map(({ tag }) => tag), auth)] += 1
    all.push({ company: job.company, title: job.title, url: job.url, locations: job.locations, tags: tags.map(({ tag, evidence }) => ({ tag, evidence })) })
  })

  print(`${all.length.toLocaleString("en-US")} jobs in the US or with no country`)
  for (const [tag, count] of [...tagCounts].sort((a, b) => b[1] - a[1])) print(`  ${tag}  ${count.toLocaleString("en-US")}`)
  const effects = (Object.entries(effectCounts) as [Effect, number][]).map(([effect, count]) => `${effect} ${count.toLocaleString("en-US")}`)
  print(`For ${auth.status}: ${effects.join(", ")}`)

  const withTags = all.filter((entry) => entry.tags.some(({ tag }) => tag !== "not-stated"))
  const file = join(dataDir, "tag-check.json")
  await writeJsonFile(file, { withTags: pickSample(withTags, SAMPLE_SIZE), random: pickSample(all, SAMPLE_SIZE) })
  print(`Wrote a sample to check by hand: ${file}`)
}

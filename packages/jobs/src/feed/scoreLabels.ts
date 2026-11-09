// Scores the readers against a hand-labelled set of real postings, so a rule change can be shown to help or hurt.
import { degreeRequired, DEGREES } from "../matching/degree"
import { yearsWithMaster } from "../matching/experience"
import { readPay } from "../matching/pay"
import { countryOf } from "../sources/country"
import { jobEffect } from "../tags/effects"
import { tagJob } from "../tags/tagJob"
import type { AuthTag, Degree, JobRecord, WorkAuth } from "../types"

export type LabelledPay = { min: number; max: number; per: "year" | "hour" }

// "?" marks a fact the posting's text could not settle, which is left out of the score.
export type Labels = {
  restrictions: AuthTag[] | "?"
  years: number | null | "?"
  degree: Degree | null | "?"
  pay: LabelledPay | null | "?"
  abroad: boolean
}

export type LabelledJob = { job: JobRecord; labels: Labels }
export type Me = { workAuth: WorkAuth; maxYears: number; degree: Degree }
export type FieldScore = { right: number; total: number; misses: string[] }
export type HideScore = { right: number; total: number; wronglyHidden: string[]; wronglyShown: string[] }
export type LabelReport = { fields: Record<"tags" | "years" | "degree" | "pay" | "abroad", FieldScore>; hide: HideScore }

type Facts = { abroad: boolean; tags: readonly AuthTag[]; years: number | null; degree: Degree | null }

// Returns the tags that state a rule, in order, with the ones another tag already covers left out.
function comparableTags(tags: readonly AuthTag[]): AuthTag[] {
  return tags
    .filter((tag) => tag !== "unclear" && tag !== "not-stated")
    .filter((tag) => !(tag === "no-sponsorship" && tags.includes("no-future-sponsorship")))
    .filter((tag) => !(tag === "us-person" && tags.includes("citizen-only")))
    .sort()
}

// Writes a tag list for a miss line.
function tagsText(tags: readonly AuthTag[]): string {
  return tags.length > 0 ? tags.join(", ") : "none"
}

// Writes a pay range for a miss line.
function payText(pay: LabelledPay | null): string {
  return pay ? `${pay.min}-${pay.max}/${pay.per}` : "none"
}

// Returns the reason these facts would hide the job for this user, or undefined when they would not.
function hideReason(facts: Facts, me: Me): string | undefined {
  if (facts.abroad) return "abroad"
  if (jobEffect(facts.tags, me.workAuth) === "blocked") return "blocked"
  if (facts.years !== null && facts.years > me.maxYears) return "experience"
  if (facts.degree !== null && DEGREES.indexOf(facts.degree) > DEGREES.indexOf(me.degree)) return "degree"
  return undefined
}

// Adds one comparison to a field's score, recording a miss with what was read and what the label says.
function compare(field: FieldScore, name: string, read: string, label: string): void {
  field.total += 1
  if (read === label) field.right += 1
  else field.misses.push(`${name}: read ${read}, label ${label}`)
}

// Compares what the readers find in each posting with its labels, field by field, and counts jobs the readers would
// wrongly hide or wrongly show for this user.
export function scoreLabels(jobs: readonly LabelledJob[], me: Me): LabelReport {
  const empty = (): FieldScore => ({ right: 0, total: 0, misses: [] })
  const fields = { tags: empty(), years: empty(), degree: empty(), pay: empty(), abroad: empty() }
  const hide: HideScore = { right: 0, total: 0, wronglyHidden: [], wronglyShown: [] }

  for (const { job, labels } of jobs) {
    const name = `${job.company} | ${job.title}`
    const pay = job.pay ?? readPay(job.description)
    const read: Facts = {
      abroad: job.country === "other" || countryOf(job.locations) === "other",
      tags: comparableTags(tagJob(job).map(({ tag }) => tag)),
      years: yearsWithMaster(`${job.title}\n${job.description}`) ?? null,
      degree: degreeRequired(job.description, job.title) ?? null,
    }

    if (labels.restrictions !== "?") compare(fields.tags, name, tagsText(read.tags), tagsText(comparableTags(labels.restrictions)))
    if (labels.years !== "?") compare(fields.years, name, String(read.years ?? "none"), String(labels.years ?? "none"))
    if (labels.degree !== "?") compare(fields.degree, name, read.degree ?? "none", labels.degree ?? "none")
    if (labels.pay !== "?") compare(fields.pay, name, payText(pay ? { min: pay.min, max: pay.max, per: pay.per } : null), payText(labels.pay))
    compare(fields.abroad, name, String(read.abroad), String(labels.abroad))

    if (labels.restrictions === "?" || labels.years === "?" || labels.degree === "?") continue
    const truth: Facts = { abroad: labels.abroad, tags: labels.restrictions, years: labels.years, degree: labels.degree }
    const readReason = hideReason(read, me)
    const truthReason = hideReason(truth, me)
    hide.total += 1
    if (Boolean(readReason) === Boolean(truthReason)) hide.right += 1
    else if (readReason) hide.wronglyHidden.push(`${name}: hidden for ${readReason}, labels say show`)
    else hide.wronglyShown.push(`${name}: shown, labels say ${truthReason}`)
  }
  return { fields, hide }
}

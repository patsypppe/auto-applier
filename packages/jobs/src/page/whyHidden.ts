// Writes the line a hidden card shows: why the job was hidden, with the value used, and the chip or setting it came from.
import { HIDE_REASONS, type HideReason } from "../feed/applyFilters"
import type { Filters } from "../settings"
import type { Degree } from "../types"
import type { ChipChoices } from "./chips"

type Source = { chip?: keyof ChipChoices; chipName?: string; setting: string }

const DEGREE_NAMES: Record<Degree, string> = { associate: "associate's", bachelor: "bachelor's", master: "master's", phd: "PhD" }

const PANEL = "in the settings panel"
const FILE = "in data/settings.json"

// Joins a list for a sentence, or says "none" when it is empty.
function listed(items: readonly string[]): string {
  return items.length > 0 ? items.map((item) => item.replace("-", " ")).join(", ") : "none"
}

// Returns what hid the job, in words, and where that value is set, for each reason.
function explain(reason: HideReason, filters: Filters): [string, Source] {
  switch (reason) {
    case "abroad":
      return ["it is outside the US", { setting: `includeAbroad ${FILE}` }]
    case "blocked":
      return ["its work-authorization tags block your status", { setting: `hideBlocked ${FILE}` }]
    case "likely-blocked":
      return ["its work-authorization tags probably block your status", { setting: `hideLikelyBlocked ${FILE}` }]
    case "role":
      return [`its title matches none of your roles (${listed(filters.roles)})`, { setting: `Roles ${PANEL}` }]
    case "title-word":
      return [`its title has a word you left out (${listed(filters.excludeTitleWords)})`, { setting: `excludeTitleWords ${FILE}` }]
    case "level":
      return [`its level is not one you chose (${listed(filters.levels)})`, { chip: "level", chipName: "the Level chips", setting: `the levels ${PANEL}` }]
    case "experience":
      return [`it asks for more than ${filters.maxYearsRequired} years of experience`, { chip: "maxYears", chipName: "the Years asked chip", setting: `Most years of experience asked ${PANEL}` }]
    case "degree":
      return [`it asks for a higher degree than your ${filters.myDegree ? DEGREE_NAMES[filters.myDegree] : "own"}`, { chip: "degree", chipName: "the Degree chip", setting: `My highest degree ${PANEL}` }]
    case "location":
      return [`none of its places match ${listed(filters.locations)}`, { setting: `Places ${PANEL}` }]
    case "remote":
      return ["it is not remote", { setting: `Remote only ${PANEL}` }]
    case "workplace":
      return [`its workplace is not one you chose (${listed(filters.workplaces)})`, { chip: "workplace", chipName: "the Workplace chips", setting: `workplaces ${FILE}` }]
    case "job-type":
      return [`its job type is not one you chose (${listed(filters.jobTypes)})`, { chip: "jobType", chipName: "the Job type chips", setting: `jobTypes ${FILE}` }]
    case "pay":
      return [`it pays less than $${filters.minYearlyPay.toLocaleString("en-US")} a year`, { chip: "minPay", chipName: "the Pay chip", setting: `minYearlyPay ${FILE}` }]
    case "old":
      return [`it was posted more than ${filters.postedWithinDays} days ago`, { chip: "within", chipName: "the Posted chip", setting: `Posted within ${PANEL}` }]
    case "company":
      return ["its company is left out by your company lists", { setting: `companies ${FILE}` }]
    case "score":
      return [`its match score is below ${filters.minScore}`, { setting: `minScore ${FILE}` }]
  }
}

// Returns the sentence for a hide reason, naming the chip when the user's stored chip set the value and the setting
// otherwise, or undefined for a reason this page does not know.
export function whyHidden(reason: string, filters: Filters, chips: Partial<ChipChoices>): string | undefined {
  const known = HIDE_REASONS.find((name) => name === reason)
  if (!known) return undefined
  const [what, source] = explain(known, filters)
  const by = source.chip && chips[source.chip] !== undefined ? source.chipName : source.setting
  return `Hidden because ${what}. Set by ${by}.`
}

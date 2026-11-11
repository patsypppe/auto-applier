// The values the settings and filters take, kept apart from settings.ts so the page can use them too.
import type { JobType, Level, WorkAuth, WorkAuthStatus, Workplace } from "../types"

export const STATUSES: readonly WorkAuthStatus[] = ["citizen", "permanent-resident", "f1-cpt", "f1-opt", "f1-stem-opt", "h1b", "other-needs-sponsorship"]
export const CLEARANCES: readonly WorkAuth["clearance"][] = ["none", "can-obtain", "active"]

export const LEVELS: readonly Level[] = ["intern", "new-grad", "entry", "mid", "senior", "staff"]
export const WORKPLACES: readonly Workplace[] = ["remote", "hybrid", "onsite"]
export const JOB_TYPES: readonly JobType[] = ["full-time", "part-time", "contract", "intern", "temporary"]

// Returns what a person with this status usually has: students and visa holders will need sponsorship later, and only a
// citizen can obtain a clearance. The settings file and the settings panel both start from these.
export function workAuthDefaults(status: WorkAuthStatus): Pick<WorkAuth, "needsSponsorshipLater" | "clearance"> {
  return {
    needsSponsorshipLater: status.startsWith("f1-") || status === "h1b" || status === "other-needs-sponsorship",
    clearance: status === "citizen" ? "can-obtain" : "none",
  }
}

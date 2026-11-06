// Says what each work-authorization tag means for the user's own status: blocked, likely blocked, fine, or a plus.
import type { AuthTag, Effect, WorkAuth, WorkAuthStatus } from "../types"

type Rule = Effect | ((auth: WorkAuth) => Effect)

const F1: readonly WorkAuthStatus[] = ["f1-cpt", "f1-opt", "f1-stem-opt"]
const NEEDS_SPONSORSHIP_NOW: readonly WorkAuthStatus[] = ["h1b", "other-needs-sponsorship"]

// "No sponsorship" stops someone who needs it now, and probably stops a student who will need it after OPT.
const noSponsorship: Rule = (auth) => {
  if (NEEDS_SPONSORSHIP_NOW.includes(auth.status)) return "blocked"
  return F1.includes(auth.status) && auth.needsSponsorshipLater ? "likely-blocked" : "ok"
}

// "Now or in the future" stops everyone who will ever need sponsorship.
const noFutureSponsorship: Rule = (auth) => {
  if (NEEDS_SPONSORSHIP_NOW.includes(auth.status)) return "blocked"
  return F1.includes(auth.status) && auth.needsSponsorshipLater ? "blocked" : "ok"
}

// Clearances are for citizens; whether a permanent resident can hold one is not checked against an official source.
const clearance: Rule = (auth) => {
  if (auth.status === "citizen") return auth.clearance === "none" ? "likely-blocked" : "ok"
  return auth.status === "permanent-resident" ? "likely-blocked" : "blocked"
}

// An offer of sponsorship matters to students and anyone who needs a visa.
const sponsors: Rule = (auth) => (F1.includes(auth.status) || NEEDS_SPONSORSHIP_NOW.includes(auth.status) ? "positive" : "ok")

// Returns true for someone on STEM OPT, or an F-1 student with a STEM degree who can move on to it.
export function canUseStemOpt(auth: WorkAuth): boolean {
  return auth.status === "f1-stem-opt" || (F1.includes(auth.status) && auth.stemDegree)
}

// STEM OPT needs an employer enrolled in E-Verify, so it is a plus for a student with a STEM degree.
const eVerify: Rule = (auth) => (canUseStemOpt(auth) ? "positive" : "ok")

const EFFECTS: Record<AuthTag, Rule> = {
  "citizen-only": (auth) => (auth.status === "citizen" ? "ok" : "blocked"),
  "us-person": (auth) => (auth.status === "citizen" || auth.status === "permanent-resident" ? "ok" : "blocked"),
  clearance,
  "no-sponsorship": noSponsorship,
  "no-future-sponsorship": noFutureSponsorship,
  "no-visa-holders": (auth) => (auth.status === "citizen" || auth.status === "permanent-resident" ? "ok" : "blocked"),
  sponsors,
  "opt-cpt-welcome": (auth) => (F1.includes(auth.status) ? "positive" : "ok"),
  "e-verify": eVerify,
  unclear: "ok",
  "not-stated": "ok",
}

// Returns what one tag means for this user.
export function effectOf(tag: AuthTag, auth: WorkAuth): Effect {
  const rule = EFFECTS[tag]
  return typeof rule === "function" ? rule(auth) : rule
}

// Returns the worst effect among a job's tags; a job is a plus only when none of its tags is worse than fine.
export function jobEffect(tags: readonly AuthTag[], auth: WorkAuth): Effect {
  const effects = tags.map((tag) => effectOf(tag, auth))
  if (effects.includes("blocked")) return "blocked"
  if (effects.includes("likely-blocked")) return "likely-blocked"
  return effects.includes("positive") ? "positive" : "ok"
}

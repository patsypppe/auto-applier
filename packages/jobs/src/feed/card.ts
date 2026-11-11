// The slim form of a ranked job that the feed page shows: everything on the card, without the long description.
import type { EmployerHistory } from "../history/matchEmployer"
import type { MatchReasons } from "../matching/scoreMatch"
import type { Effect, JobCopy, JobType, Pay, Tag, Workplace } from "../types"
import type { RankedJob } from "./getJobs"

export type Card = {
  key: string
  company: string
  title: string
  url: string
  locations: string[]
  country?: "US" | "other"
  postedAt?: string
  firstSeenAt: string
  repostOf?: string
  copies?: JobCopy[]
  score: number
  effect: Effect
  reasons: MatchReasons
  tags: Tag[]
  pay?: Pay
  jobType?: JobType
  workplace?: Workplace
  history?: EmployerHistory
}

// Returns true when a STEM OPT student can work at the job: the employer uses E-Verify everywhere and nothing else blocks
// it. The card's badge and the page's "E-Verify only" chip both use this, so they always agree.
export function stemOptCanWork(card: Pick<Card, "tags" | "effect">): boolean {
  return card.effect === "positive" && card.tags.some((found) => found.tag === "e-verify")
}

// Turns a ranked job into a card.
export function toCard({ job, score, effect, reasons, tags, pay, history }: RankedJob): Card {
  return {
    key: job.key,
    company: job.company,
    title: job.title,
    url: job.url,
    locations: job.locations,
    country: job.country,
    postedAt: job.postedAt,
    firstSeenAt: job.firstSeenAt,
    repostOf: job.repostOf,
    copies: job.copies,
    score,
    effect,
    reasons,
    tags,
    pay,
    jobType: job.jobType,
    workplace: job.workplace,
    history,
  }
}

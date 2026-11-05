// Defines the shape of a collected job, a company's board, and a job site that boards are read from.
export type Ats = "greenhouse" | "lever" | "ashby" | "workday"

export type Board = {
  ats: Ats
  slug: string
  region?: "eu"
}

export type Company = Board & {
  name: string
  sources: string[]
}

export type JobCopy = { id: string; url: string; locations: string[] }

export type Pay = { min: number; max: number; currency: string; per: "year" | "hour"; from: "board" | "text" }

export type JobType = "full-time" | "part-time" | "contract" | "intern" | "temporary"

export type Workplace = "remote" | "hybrid" | "onsite"

export type Degree = "associate" | "bachelor" | "master" | "phd"

export type JobRecord = {
  key: string
  ats: Ats
  slug: string
  company: string
  id: string
  title: string
  url: string
  locations: string[]
  country?: "US" | "other"
  postedAt?: string
  updatedAt?: string
  firstSeenAt: string
  lastSeenAt: string
  description: string
  textHash?: string
  repostOf?: string
  copies?: JobCopy[]
  pay?: Pay
  jobType?: JobType
  workplace?: Workplace
}

export type GetJson = (url: string, body?: unknown) => Promise<unknown>

// What to search a board for, from the user's settings; only Workday, which has no plain job list, uses it.
export type BoardSearch = { roles: readonly string[]; excludeTitleWords?: readonly string[]; includeAbroad?: boolean }

export type BoardSource = {
  ats: Ats
  name: string
  fetchRaw: (board: Pick<Board, "slug" | "region">, getJson: GetJson, search?: BoardSearch) => Promise<unknown>
  readJobs: (raw: unknown, slug: string, seenAt: string) => JobRecord[]
}

export type AuthTag =
  | "citizen-only"
  | "us-person"
  | "clearance"
  | "no-sponsorship"
  | "no-future-sponsorship"
  | "no-visa-holders"
  | "sponsors"
  | "opt-cpt-welcome"
  | "e-verify"
  | "unclear"
  | "not-stated"

export type Tag = { tag: AuthTag; evidence: string; context: string }

export type WorkAuthStatus =
  | "citizen"
  | "permanent-resident"
  | "f1-cpt"
  | "f1-opt"
  | "f1-stem-opt"
  | "h1b"
  | "other-needs-sponsorship"

export type WorkAuth = {
  status: WorkAuthStatus
  needsSponsorshipLater: boolean
  stemDegree: boolean
  clearance: "none" | "can-obtain" | "active"
}

export type Effect = "blocked" | "likely-blocked" | "ok" | "positive"

export type Level = "intern" | "new-grad" | "entry" | "mid" | "senior" | "staff"

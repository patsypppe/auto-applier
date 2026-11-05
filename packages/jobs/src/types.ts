// Defines the shape of a collected job, a company's board, and a job site that boards are read from.
export type Ats = "greenhouse" | "lever" | "ashby"

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
}

export type GetJson = (url: string, body?: unknown) => Promise<unknown>

export type BoardSource = {
  ats: Ats
  name: string
  fetchRaw: (board: Pick<Board, "slug" | "region">, getJson: GetJson) => Promise<unknown>
  readJobs: (raw: unknown, slug: string, seenAt: string) => JobRecord[]
}

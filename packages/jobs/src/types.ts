// Defines the shape of a collected job and of a job site that boards are read from.
export type Ats = "greenhouse" | "lever" | "ashby"

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
}

export type GetJson = (url: string, body?: unknown) => Promise<unknown>

export type BoardSource = {
  ats: Ats
  name: string
  fetchRaw: (slug: string, getJson: GetJson) => Promise<unknown>
  readJobs: (raw: unknown, slug: string, seenAt: string) => JobRecord[]
}

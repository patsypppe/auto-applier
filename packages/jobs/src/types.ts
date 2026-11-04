// Defines the shape of a collected job, shared by every job board reader.
export type Ats = "greenhouse"

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

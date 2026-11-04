// Reads a company's public Ashby job board and turns its listed jobs into job records.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import type { BoardSource, JobRecord } from "../types"
import { countryOf } from "./country"
import { htmlToText } from "./plainText"

z.config(en())

const BOARD_URL = "https://api.ashbyhq.com/posting-api/job-board"

const text = z.nullish(z.string())
const addressSchema = z.nullish(z.object({ postalAddress: z.nullish(z.object({ addressCountry: text })) }))

const jobSchema = z.object({
  id: text,
  title: text,
  jobUrl: text,
  location: text,
  address: addressSchema,
  secondaryLocations: z.nullish(z.array(z.object({ location: text, address: addressSchema }))),
  isListed: z.nullish(z.boolean()),
  publishedAt: text,
  descriptionPlain: text,
  descriptionHtml: text,
})

const boardSchema = z.object({ jobs: z.array(z.unknown()) })

type AshbyJob = z.infer<typeof jobSchema>

// Lists the main location and every secondary one.
function locationsOf(job: AshbyJob): string[] {
  return [job.location ?? "", ...(job.secondaryLocations ?? []).map((place) => place.location ?? "")]
    .map((place) => place.trim())
    .filter((place) => place !== "")
}

// Lists the countries written in the job's addresses, which say more than a location like "Toronto, ON".
function addressCountries(job: AshbyJob): string[] {
  const addresses = [job.address, ...(job.secondaryLocations ?? []).map((place) => place.address)]
  return addresses.map((address) => address?.postalAddress?.addressCountry ?? "").filter((country) => country !== "")
}

// Turns one job into a record, or returns undefined when it is unlisted or has no id, title or link.
function toJobRecord(raw: unknown, slug: string, seenAt: string): JobRecord | undefined {
  const parsed = jobSchema.safeParse(raw)
  if (!parsed.success) return undefined

  const job = parsed.data
  const title = (job.title ?? "").trim()
  if (job.isListed === false || !job.id || title === "" || !job.jobUrl) return undefined

  const locations = locationsOf(job)
  return {
    key: `ashby:${slug}:${job.id}`,
    ats: "ashby",
    slug,
    company: slug,
    id: job.id,
    title,
    url: job.jobUrl,
    locations,
    country: countryOf([...locations, ...addressCountries(job)]),
    postedAt: job.publishedAt ?? undefined,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    description: job.descriptionPlain?.trim() || htmlToText(job.descriptionHtml ?? ""),
  }
}

export const ashby: BoardSource = {
  ats: "ashby",
  name: "Ashby",

  // Asks for every job on the board in one request.
  fetchRaw: ({ slug }, getJson) => getJson(`${BOARD_URL}/${encodeURIComponent(slug)}`),

  // Reads the board's answer into job records, skipping unlisted jobs and jobs that cannot be read.
  readJobs: (raw, slug, seenAt) => {
    const board = boardSchema.safeParse(raw)
    if (!board.success) throw new Error(`Ashby board '${slug}' sent an answer without a jobs list.`)
    return board.data.jobs.flatMap((job) => toJobRecord(job, slug, seenAt) ?? [])
  },
}

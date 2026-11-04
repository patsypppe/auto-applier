// Reads a company's public Greenhouse job board and turns its jobs into job records.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import type { BoardSource, JobRecord } from "../types"
import { countryOf } from "./country"
import { htmlToText } from "./plainText"

z.config(en())

const BOARDS_URL = "https://boards-api.greenhouse.io/v1/boards"

const text = z.nullish(z.string())

const jobSchema = z.object({
  id: z.nullish(z.union([z.number(), z.string()])),
  title: text,
  absolute_url: text,
  company_name: text,
  location: z.nullish(z.object({ name: text })),
  offices: z.nullish(z.array(z.object({ name: text, location: text }))),
  first_published: text,
  updated_at: text,
  content: text,
})

const boardSchema = z.object({ jobs: z.array(z.unknown()) })

type GreenhouseJob = z.infer<typeof jobSchema>

// Splits Greenhouse's location text, which joins several places with semicolons.
function locationsOf(job: GreenhouseJob): string[] {
  return (job.location?.name ?? "")
    .split(";")
    .map((place) => place.trim())
    .filter((place) => place !== "")
}

// Lists the office names and addresses, which often name the country when the location is only a city.
function officeTexts(job: GreenhouseJob): string[] {
  return (job.offices ?? []).flatMap((office) => [office.name ?? "", office.location ?? ""]).filter((text) => text !== "")
}

// Turns one job from the board into a record, or returns undefined when it has no id, title or link.
function toJobRecord(raw: unknown, slug: string, seenAt: string): JobRecord | undefined {
  const parsed = jobSchema.safeParse(raw)
  if (!parsed.success) return undefined

  const job = parsed.data
  const title = (job.title ?? "").trim()
  if (job.id === null || job.id === undefined || title === "" || !job.absolute_url) return undefined

  const locations = locationsOf(job)
  return {
    key: `greenhouse:${slug}:${job.id}`,
    ats: "greenhouse",
    slug,
    company: job.company_name?.trim() || slug,
    id: String(job.id),
    title,
    url: job.absolute_url,
    locations,
    country: countryOf([...locations, ...officeTexts(job)]),
    postedAt: job.first_published ?? undefined,
    updatedAt: job.updated_at ?? undefined,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    description: htmlToText(job.content ?? ""),
  }
}

export const greenhouse: BoardSource = {
  ats: "greenhouse",
  name: "Greenhouse",

  // Asks for every job on the board, with descriptions, in one request.
  fetchRaw: (slug, getJson) => getJson(`${BOARDS_URL}/${encodeURIComponent(slug)}/jobs?content=true`),

  // Reads the board's answer into job records, skipping jobs that cannot be read.
  readJobs: (raw, slug, seenAt) => {
    const board = boardSchema.safeParse(raw)
    if (!board.success) throw new Error(`Greenhouse board '${slug}' sent an answer without a jobs list.`)
    return board.data.jobs.flatMap((job) => toJobRecord(job, slug, seenAt) ?? [])
  },
}

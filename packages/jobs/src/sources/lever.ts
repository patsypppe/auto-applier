// Reads a company's public Lever postings and turns them into job records.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import type { BoardSource, JobRecord } from "../types"
import { countryOf } from "./country"
import { htmlToText } from "./plainText"

z.config(en())

const POSTINGS_URL = "https://api.lever.co/v0/postings"

const text = z.nullish(z.string())

const postingSchema = z.object({
  id: text,
  text,
  hostedUrl: text,
  country: text,
  createdAt: z.nullish(z.number()),
  categories: z.nullish(z.object({ location: text, allLocations: z.nullish(z.array(z.string())) })),
  descriptionPlain: text,
  lists: z.nullish(z.array(z.object({ text, content: text }))),
  additionalPlain: text,
})

type LeverPosting = z.infer<typeof postingSchema>

// Lists every place the posting names, falling back to its single location.
function locationsOf(posting: LeverPosting): string[] {
  const all = posting.categories?.allLocations ?? []
  const places = all.length > 0 ? all : [posting.categories?.location ?? ""]
  return places.map((place) => place.trim()).filter((place) => place !== "")
}

// Uses Lever's two-letter country code when there is one, since "CA" there means Canada, not California.
function countryOfPosting(posting: LeverPosting, locations: string[]): JobRecord["country"] {
  const code = posting.country?.trim().toUpperCase()
  if (code) return code === "US" ? "US" : "other"
  return countryOf(locations)
}

// Joins the opening text, each list with its heading, and the closing text into one plain description.
function descriptionOf(posting: LeverPosting): string {
  const lists = (posting.lists ?? []).flatMap((list) => [list.text ?? "", htmlToText(list.content ?? "")])
  return [posting.descriptionPlain ?? "", ...lists, posting.additionalPlain ?? ""]
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .join("\n")
}

// Turns one posting into a record, or returns undefined when it has no id, title or link.
function toJobRecord(raw: unknown, slug: string, seenAt: string): JobRecord | undefined {
  const parsed = postingSchema.safeParse(raw)
  if (!parsed.success) return undefined

  const posting = parsed.data
  const title = (posting.text ?? "").trim()
  if (!posting.id || title === "" || !posting.hostedUrl) return undefined

  const locations = locationsOf(posting)
  return {
    key: `lever:${slug}:${posting.id}`,
    ats: "lever",
    slug,
    company: slug,
    id: posting.id,
    title,
    url: posting.hostedUrl,
    locations,
    country: countryOfPosting(posting, locations),
    postedAt: typeof posting.createdAt === "number" ? new Date(posting.createdAt).toISOString() : undefined,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    description: descriptionOf(posting),
  }
}

export const lever: BoardSource = {
  ats: "lever",
  name: "Lever",

  // Asks for every published posting on the board in one request.
  fetchRaw: (slug, getJson) => getJson(`${POSTINGS_URL}/${encodeURIComponent(slug)}?mode=json`),

  // Reads Lever's list of postings into job records, skipping postings that cannot be read.
  readJobs: (raw, slug, seenAt) => {
    if (!Array.isArray(raw)) throw new Error(`Lever board '${slug}' sent an answer without a postings list.`)
    return raw.flatMap((posting) => toJobRecord(posting, slug, seenAt) ?? [])
  },
}

// Reads a company's public Lever postings and turns them into job records.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import { isSensiblePay } from "../matching/pay"
import type { BoardSource, JobRecord, JobType, Pay, Workplace } from "../types"
import { countryOf } from "./country"
import { definedOnly } from "./definedOnly"
import { htmlToText } from "./plainText"

z.config(en())

const POSTINGS_URL = "https://api.lever.co/v0/postings"
const EU_POSTINGS_URL = "https://api.eu.lever.co/v0/postings"

const text = z.nullish(z.string())

const postingSchema = z.object({
  id: text,
  text,
  hostedUrl: text,
  country: text,
  createdAt: z.nullish(z.number()),
  categories: z.nullish(z.object({ location: text, commitment: text, allLocations: z.nullish(z.array(z.string())) })),
  workplaceType: text,
  salaryRange: z.nullish(z.object({ min: z.nullish(z.number()), max: z.nullish(z.number()), currency: text, interval: text })),
  descriptionPlain: text,
  lists: z.nullish(z.array(z.object({ text, content: text }))),
  additionalPlain: text,
})

type LeverPosting = z.infer<typeof postingSchema>

const PAY_PERIODS: Record<string, Pay["per"]> = { "per-year-salary": "year", "per-hour-wage": "hour" }
const WORKPLACES: Record<string, Workplace> = { onsite: "onsite", hybrid: "hybrid", remote: "remote" }

// Commitment is free text the company types, so it is read by its words, the more specific first. "Full time or Part
// time" says neither, and words like "Remote" or "CDI" are not a job type.
const COMMITMENTS: readonly [RegExp, JobType | undefined][] = [
  [/\bintern(ship)?\b/i, "intern"],
  [/\b(temporary|seasonal)\b/i, "temporary"],
  [/\b(contract|contractor|freelance)\b/i, "contract"],
  [/\bfull[- ]?time\b.*\bor\b.*\bpart[- ]?time\b/i, undefined],
  [/\bpart[- ]?time\b/i, "part-time"],
  [/\b(full[- ]?time|permanent|regular)\b/i, "full-time"],
]

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

// Returns the job type the commitment names, or undefined when it names none.
function jobTypeOf(commitment: string | null | undefined): JobType | undefined {
  return COMMITMENTS.find(([pattern]) => pattern.test(commitment ?? ""))?.[1]
}

// Returns Lever's salary range when it is paid by the year or the hour, the two the feed compares, and is believable.
function payOf(posting: LeverPosting): Pay | undefined {
  const range = posting.salaryRange
  const per = PAY_PERIODS[range?.interval ?? ""]
  if (!range?.min || !range.max || !per) return undefined
  const pay: Pay = { min: range.min, max: range.max, currency: range.currency ?? "USD", per, from: "board" }
  return isSensiblePay(pay) ? pay : undefined
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
    ...definedOnly({ pay: payOf(posting), jobType: jobTypeOf(posting.categories?.commitment), workplace: WORKPLACES[posting.workplaceType ?? ""] }),
  }
}

export const lever: BoardSource = {
  ats: "lever",
  name: "Lever",

  // Asks for every published posting on the board in one request, from Lever's EU host for boards that live there.
  fetchRaw: ({ slug, region }, getJson) =>
    getJson(`${region === "eu" ? EU_POSTINGS_URL : POSTINGS_URL}/${encodeURIComponent(slug)}?mode=json`),

  // Reads Lever's list of postings into job records, skipping postings that cannot be read.
  readJobs: (raw, slug, seenAt) => {
    if (!Array.isArray(raw)) throw new Error(`Lever board '${slug}' sent an answer without a postings list.`)
    return raw.flatMap((posting) => toJobRecord(posting, slug, seenAt) ?? [])
  },
}

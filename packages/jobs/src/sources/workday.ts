// Reads a company's Workday career site: searches it for each wanted role, then fetches the details of jobs whose title
// fits. Workday has no documented API; these are the requests its own career pages make.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import { titleHasRole } from "../matching/scoreMatch"
import type { BoardSearch, BoardSource, JobRecord } from "../types"
import { countryOf } from "./country"
import { htmlToText } from "./plainText"

z.config(en())

const PAGE_SIZE = 20
// Searches match descriptions too, so a broad role can return hundreds of jobs; ten pages per role is plenty.
const MAX_PAGES_PER_ROLE = 10

const postingSchema = z.object({ title: z.nullish(z.string()), externalPath: z.nullish(z.string()), locationsText: z.nullish(z.string()) })
const pageSchema = z.object({ total: z.nullish(z.number()), jobPostings: z.nullish(z.array(postingSchema)) })

const detailSchema = z.object({
  jobPostingInfo: z.object({
    id: z.nullish(z.string()),
    title: z.nullish(z.string()),
    jobDescription: z.nullish(z.string()),
    location: z.nullish(z.string()),
    additionalLocations: z.nullish(z.array(z.string())),
    startDate: z.nullish(z.string()),
    externalUrl: z.nullish(z.string()),
    country: z.nullish(z.object({ descriptor: z.nullish(z.string()) })),
  }),
})

type Posting = { title: string; externalPath: string; locationsText: string }
type Raw = { postings: Posting[]; details: Record<string, unknown> }

// Splits "tenant|wdN|site" into the parts of the board's address.
function partsOf(slug: string): { tenant: string; host: string; site: string } {
  const [tenant, wd, site] = slug.split("|")
  if (!tenant || !wd || !/^wd\d+$/.test(wd) || !site) {
    throw new Error(`Workday board '${slug}' must be written as tenant|wdN|site, for example adobe|wd5|external_experienced.`)
  }
  return { tenant, host: `${tenant}.${wd}.myworkdayjobs.com`, site }
}

// Pages through one role's search until the first page's total is reached; later pages report a total of 0.
async function searchRole(base: string, role: string, getJson: (url: string, body?: unknown) => Promise<unknown>) {
  const found: Raw["postings"] = []
  let total = Infinity
  for (let page = 0; page < MAX_PAGES_PER_ROLE && page * PAGE_SIZE < total; page += 1) {
    const body = { appliedFacets: {}, limit: PAGE_SIZE, offset: page * PAGE_SIZE, searchText: role }
    const answer = pageSchema.safeParse(await getJson(`${base}/jobs`, body))
    const postings = answer.success ? (answer.data.jobPostings ?? []) : []
    if (page === 0) total = answer.success ? (answer.data.total ?? 0) : 0
    if (postings.length === 0) break
    for (const posting of postings) {
      if (posting.title && posting.externalPath) found.push({ title: posting.title, externalPath: posting.externalPath, locationsText: posting.locationsText ?? "" })
    }
  }
  return found
}

// Returns true when a posting is worth a detail request: its title holds a wanted role and no left-out word, and its listed
// place is not clearly abroad (unless the user wants jobs abroad). "3 Locations" says nothing, so those are still fetched.
function worthDetails(posting: Posting, search: BoardSearch): boolean {
  if (!titleHasRole(posting.title, search.roles)) return false
  if (titleHasRole(posting.title, search.excludeTitleWords ?? [])) return false
  return search.includeAbroad === true || countryOf([posting.locationsText]) !== "other"
}

// Turns one job's details into a record, or returns undefined when the details cannot be read.
function toJobRecord(raw: unknown, slug: string, tenant: string, seenAt: string): JobRecord | undefined {
  const parsed = detailSchema.safeParse(raw)
  if (!parsed.success) return undefined

  const info = parsed.data.jobPostingInfo
  const title = (info.title ?? "").trim()
  if (!info.id || title === "" || !info.externalUrl) return undefined

  const locations = [info.location ?? "", ...(info.additionalLocations ?? [])].map((place) => place.trim()).filter((place) => place !== "")
  return {
    key: `workday:${slug}:${info.id}`,
    ats: "workday",
    slug,
    company: tenant,
    id: info.id,
    title,
    url: info.externalUrl,
    locations,
    country: countryOf([...locations, info.country?.descriptor ?? ""]),
    postedAt: info.startDate ?? undefined,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    description: htmlToText(info.jobDescription ?? ""),
  }
}

export const workday: BoardSource = {
  ats: "workday",
  name: "Workday",

  // Searches for each role, then fetches the details of every distinct job the feed could show.
  fetchRaw: async ({ slug }, getJson, search) => {
    const roles = search?.roles ?? []
    if (!search || roles.length === 0) throw new Error(`Workday board '${slug}' needs roles in data/settings.json, so only matching jobs are read.`)

    const { host, tenant, site } = partsOf(slug)
    const base = `https://${host}/wday/cxs/${tenant}/${site}`
    const postings = new Map<string, Posting>()
    for (const role of roles) for (const posting of await searchRole(base, role, getJson)) postings.set(posting.externalPath, posting)

    const details: Raw["details"] = {}
    for (const posting of postings.values()) {
      if (worthDetails(posting, search)) details[posting.externalPath] = await getJson(`${base}${posting.externalPath}`)
    }
    return { postings: [...postings.values()], details } satisfies Raw
  },

  // Reads the jobs that have details; the rest did not match a role and were never fetched.
  readJobs: (raw, slug, seenAt) => {
    const answer = raw as Partial<Raw>
    if (!Array.isArray(answer.postings) || typeof answer.details !== "object" || answer.details === null) {
      throw new Error(`Workday board '${slug}' sent an answer without a postings list.`)
    }
    const { tenant } = partsOf(slug)
    const details = answer.details
    return answer.postings.flatMap((posting) => toJobRecord(details[posting.externalPath], slug, tenant, seenAt) ?? [])
  },
}

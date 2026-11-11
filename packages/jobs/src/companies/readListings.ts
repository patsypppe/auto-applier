// Finds the Greenhouse, Lever, Ashby and Workday boards behind the job links in a public listings file such as Simplify's.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import type { Board, Company } from "../types"

z.config(en())

const listingSchema = z.object({ company_name: z.nullish(z.string()), url: z.nullish(z.string()) })

// Bare language codes seen at the start of Workday addresses; Workday answered 404 when "en" and "es" were tried as sites.
const WORKDAY_LANGUAGES = new Set(["en", "es", "fr", "de", "pt", "it", "nl", "ja", "zh", "ko", "pl"])

// Decodes a slug written with %-escapes, such as "xpansiv%20", and trims it; a broken escape leaves the slug as written.
function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug).trim()
  } catch {
    return slug.trim()
  }
}

// Reads the slug from the first part of the link's path, as in jobs.lever.co/<slug>/<id>.
function firstPathPart(url: URL): string | undefined {
  return url.pathname.split("/").filter((part) => part !== "")[0]
}

// Returns true for a Workday address's language part: a language and region in any case, or a bare language code.
// Bare codes are listed, since many real sites have two-letter names, such as "jj" for Johnson & Johnson.
function isLanguagePart(part: string): boolean {
  return /^[a-z]{2}-[a-z]{2}$/i.test(part) || WORKDAY_LANGUAGES.has(part.toLowerCase())
}

// Returns the board a job link belongs to, or undefined when the link does not name one we can read.
export function boardFromUrl(link: string): Board | undefined {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return undefined
  }
  const host = url.hostname.toLowerCase()

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    // Embedded application links name the board in ?for=, and without it only carry a job token.
    const slug = url.pathname.startsWith("/embed/") ? url.searchParams.get("for") : firstPathPart(url)
    return slug ? { ats: "greenhouse", slug: slug.toLowerCase() } : undefined
  }
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    const part = firstPathPart(url)
    const slug = part && decodeSlug(part)
    if (!slug) return undefined
    return host === "jobs.eu.lever.co" ? { ats: "lever", slug: slug.toLowerCase(), region: "eu" } : { ats: "lever", slug: slug.toLowerCase() }
  }
  const workday = host.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/)
  if (workday) {
    // The site follows an optional language part, as in /en-US/<site>/job/..., /en-us/<site> or /es/<site>.
    const parts = url.pathname.split("/").filter((part) => part !== "")
    const site = isLanguagePart(parts[0] ?? "") ? parts[1] : parts[0]
    return site ? { ats: "workday", slug: `${workday[1]}|${workday[2]}|${site}` } : undefined
  }
  if (host === "jobs.ashbyhq.com") {
    const slug = firstPathPart(url)
    return slug ? { ats: "ashby", slug: decodeSlug(slug).toLowerCase() } : undefined
  }
  return undefined
}

// Reads a listings file into one company per board, named as the first listing names it, plus a count of links it could not read.
export function readListings(raw: unknown, source: string): { companies: Company[]; unreadable: number } {
  if (!Array.isArray(raw)) throw new Error(`The ${source} file is not a list of listings.`)

  const companies = new Map<string, Company>()
  let unreadable = 0
  for (const item of raw) {
    const listing = listingSchema.safeParse(item)
    const board = listing.success && listing.data.url ? boardFromUrl(listing.data.url) : undefined
    if (!listing.success || !board) {
      unreadable += 1
      continue
    }

    const key = `${board.ats}:${board.slug}`
    if (!companies.has(key)) {
      const name = listing.data.company_name?.trim() || board.slug
      companies.set(key, { name, ...board, sources: [source] })
    }
  }
  return { companies: [...companies.values()], unreadable }
}

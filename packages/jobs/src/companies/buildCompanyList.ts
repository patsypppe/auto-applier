// Joins company lists from several places into one entry per board, with the hand-kept list having the last word.
import type { Ats, Company } from "../types"

// Returns the key that identifies a board, ignoring case in the slug.
function boardKey(company: Company): string {
  return `${company.ats}:${company.slug.toLowerCase()}`
}

// Returns true when the name is only the slug, which says less than a real company name ("ramp" rather than "Ramp").
function isSlugName(company: Company): boolean {
  return company.name === company.slug
}

// Turns one of the aggregator's plain slug lists into companies named after their slugs.
export function readAggregatorList(ats: Ats, raw: unknown, source: string): Company[] {
  if (!Array.isArray(raw) || raw.some((slug) => typeof slug !== "string")) {
    throw new Error(`The ${source} ${ats} file is not a list of board names.`)
  }
  return (raw as string[])
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => slug !== "")
    .map((slug) => ({ name: slug, ats, slug, sources: [source] }))
}

// Merges the lists in order: each board appears once, keeps every source, and takes a real name over a slug.
// Entries in the hand-kept extra list replace the name of a board that is already there.
export function mergeCompanies(lists: readonly Company[][], extra: readonly Company[]): Company[] {
  const merged = new Map<string, Company>()

  for (const company of lists.flat()) {
    const key = boardKey(company)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...company, slug: company.slug.toLowerCase() })
      continue
    }
    const name = isSlugName(existing) && !isSlugName(company) ? company.name : existing.name
    merged.set(key, { ...existing, name, sources: [...new Set([...existing.sources, ...company.sources])] })
  }

  for (const company of extra) {
    const key = boardKey(company)
    const existing = merged.get(key)
    const sources = [...new Set([...(existing?.sources ?? []), ...company.sources])]
    merged.set(key, { ...existing, ...company, slug: company.slug.toLowerCase(), sources })
  }

  return [...merged.values()]
}

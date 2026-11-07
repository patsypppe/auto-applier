// Narrows the cards on the feed page by search words, work-authorization effect, application status and whether they are
// new since the last visit, and to E-Verify employers when asked, then sorts them.
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"

export type PageFilters = {
  search: string
  effect: "any" | Card["effect"]
  status: "any" | "not-tracked" | AppliedEntry["status"]
  sort: "score" | "date"
  newOnly: boolean
  eVerifyOnly: boolean
}

// Returns the card's posting date as a number, falling back to when it was first seen.
function dateOf(card: Card): number {
  return Date.parse(card.postedAt ?? card.firstSeenAt) || 0
}

// Returns true when the card was first seen after the last visit; with no earlier visit, nothing is new.
export function isNewSince(card: Card, lastVisit: string | undefined): boolean {
  return lastVisit !== undefined && Date.parse(card.firstSeenAt) > Date.parse(lastVisit)
}

// Returns the cards that pass the page's filters, best score or newest first. "New only" does nothing on a first visit.
export function filterCards(cards: readonly Card[], filters: PageFilters, applied: readonly AppliedEntry[], lastVisit?: string): Card[] {
  const statusOf = new Map(applied.map((entry) => [entry.key, entry.status]))
  const words = filters.search.toLowerCase().split(/\s+/).filter((word) => word !== "")

  return cards
    .filter((card) => {
      const haystack = [card.title, card.company, ...card.reasons.matchedSkills, ...card.reasons.missingSkills].join(" ").toLowerCase()
      if (!words.every((word) => haystack.includes(word))) return false
      if (filters.effect !== "any" && card.effect !== filters.effect) return false
      if (filters.newOnly && lastVisit !== undefined && !isNewSince(card, lastVisit)) return false
      if (filters.eVerifyOnly && !card.tags.some((found) => found.tag === "e-verify" || found.tag === "e-verify-some-places")) return false
      const status = statusOf.get(card.key)
      if (filters.status === "not-tracked") return status === undefined
      return filters.status === "any" || status === filters.status
    })
    .sort((a, b) => (filters.sort === "date" ? dateOf(b) - dateOf(a) : b.score - a.score || dateOf(b) - dateOf(a)))
}

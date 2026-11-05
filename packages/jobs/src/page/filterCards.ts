// Narrows the cards on the feed page by search words, work-authorization effect and application status, then sorts them.
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"

export type PageFilters = {
  search: string
  effect: "any" | Card["effect"]
  status: "any" | "not-tracked" | AppliedEntry["status"]
  sort: "score" | "date"
}

// Returns the card's posting date as a number, falling back to when it was first seen.
function dateOf(card: Card): number {
  return Date.parse(card.postedAt ?? card.firstSeenAt) || 0
}

// Returns the cards that pass the page's filters, best score or newest first.
export function filterCards(cards: readonly Card[], filters: PageFilters, applied: readonly AppliedEntry[]): Card[] {
  const statusOf = new Map(applied.map((entry) => [entry.key, entry.status]))
  const words = filters.search.toLowerCase().split(/\s+/).filter((word) => word !== "")

  return cards
    .filter((card) => {
      const haystack = [card.title, card.company, ...card.reasons.matchedSkills, ...card.reasons.missingSkills].join(" ").toLowerCase()
      if (!words.every((word) => haystack.includes(word))) return false
      if (filters.effect !== "any" && card.effect !== filters.effect) return false
      const status = statusOf.get(card.key)
      if (filters.status === "not-tracked") return status === undefined
      return filters.status === "any" || status === filters.status
    })
    .sort((a, b) => (filters.sort === "date" ? dateOf(b) - dateOf(a) : b.score - a.score || dateOf(b) - dateOf(a)))
}

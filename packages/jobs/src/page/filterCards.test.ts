// Tests that filterCards narrows the cards on the page by search words, work authorization and application status.
import { describe, expect, test } from "vitest"
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"
import { filterCards } from "./filterCards"

// Builds a card with the given details.
function card(key: string, details: Partial<Card> = {}): Card {
  return {
    key,
    company: "Acme",
    title: "Data Analyst",
    url: `https://boards.example/${key}`,
    locations: ["Austin, TX"],
    firstSeenAt: "2026-11-04T00:00:00Z",
    score: 50,
    effect: "ok",
    reasons: { matchedSkills: ["Python"], missingSkills: [], titleMatches: true },
    tags: [],
    ...details,
  }
}

const CARDS = [
  card("a", { title: "Data Scientist", company: "Globex", score: 90, postedAt: "2026-10-01T00:00:00Z" }),
  card("b", { effect: "likely-blocked", score: 70, postedAt: "2026-11-03T00:00:00Z" }),
  card("c", { effect: "positive", score: 60, reasons: { matchedSkills: ["Tableau"], missingSkills: [], titleMatches: true } }),
]
const APPLIED: AppliedEntry[] = [{ key: "a", company: "Globex", title: "Data Scientist", url: "u", status: "applied", changes: [] }]
const ANY = { search: "", effect: "any", status: "any", sort: "score" } as const

describe("filterCards", () => {
  test("keeps every card, best score first, when nothing is chosen", () => {
    expect(filterCards(CARDS, ANY, APPLIED).map((found) => found.key)).toEqual(["a", "b", "c"])
  })

  test("searches the title, company and skills, ignoring case", () => {
    expect(filterCards(CARDS, { ...ANY, search: "globex" }, APPLIED).map((found) => found.key)).toEqual(["a"])
    expect(filterCards(CARDS, { ...ANY, search: "tableau" }, APPLIED).map((found) => found.key)).toEqual(["c"])
  })

  test("keeps only the cards with the chosen work-authorization effect", () => {
    expect(filterCards(CARDS, { ...ANY, effect: "positive" }, APPLIED).map((found) => found.key)).toEqual(["c"])
  })

  test("keeps cards with a status, or only those without one", () => {
    expect(filterCards(CARDS, { ...ANY, status: "applied" }, APPLIED).map((found) => found.key)).toEqual(["a"])
    expect(filterCards(CARDS, { ...ANY, status: "not-tracked" }, APPLIED).map((found) => found.key)).toEqual(["b", "c"])
  })

  test("sorts by posting date, newest first, when asked", () => {
    expect(filterCards(CARDS, { ...ANY, sort: "date" }, APPLIED).map((found) => found.key)).toEqual(["c", "b", "a"])
  })
})

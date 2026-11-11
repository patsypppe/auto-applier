// The feed the page holds, checks on what the server and the browser give the page, and the line an empty list shows.
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"
import type { FeedSettings } from "../settings"
import { CHIP_NAMES, type ChipChoices, type ChipFilters } from "./chips"
import type { Visits } from "./visits"

export type Feed = {
  needsSettings?: boolean
  total: number
  shown: Card[]
  hidden: { reason: string; count: number }[]
  extra: Card[]
  applied: AppliedEntry[]
  filters?: ChipFilters
  stemOpt?: boolean
}

export type StoredFilters = Partial<Record<"search" | "effect" | "status" | "sort", string>>

// Returns the value as a plain object, or an empty one when it is anything else.
function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

// Returns true when the body has the parts of a feed the page draws.
export function isFeed(body: unknown): body is Feed {
  const feed = asObject(body)
  return typeof feed.total === "number" && ["shown", "hidden", "extra", "applied"].every((part) => Array.isArray(feed[part]))
}

// Returns true when the body carries the saved application history.
export function hasApplied(body: unknown): body is { applied: AppliedEntry[] } {
  return Array.isArray(asObject(body).applied)
}

// Returns true when the body carries saved settings, or null for a first setup.
export function hasSettings(body: unknown): body is { settings: FeedSettings | null } {
  return typeof asObject(body).settings === "object"
}

// Keeps only the known chips with text values from what the browser stored, so a broken or old value is dropped.
export function cleanChips(stored: unknown): Partial<ChipChoices> {
  const chips = asObject(stored)
  return Object.fromEntries(CHIP_NAMES.flatMap((name) => (typeof chips[name] === "string" ? [[name, chips[name]]] : [])))
}

// Keeps only the filter controls with text values from what the browser stored.
export function cleanFilters(stored: unknown): StoredFilters {
  const filters = asObject(stored)
  return Object.fromEntries(["search", "effect", "status", "sort"].flatMap((name) => (typeof filters[name] === "string" ? [[name, filters[name]]] : [])))
}

// Returns the stored visit times when they are readable dates, or undefined so the page starts as a first visit.
export function cleanVisits(stored: unknown): Visits | undefined {
  const { current, previous } = asObject(stored)
  if (typeof current !== "string" || Number.isNaN(Date.parse(current))) return undefined
  return typeof previous === "string" && !Number.isNaN(Date.parse(previous)) ? { current, previous } : { current }
}

// Says why the list of cards is empty: nothing collected, everything hidden by settings and chips, or nothing left after
// the search, the menus and the page's own chips.
export function emptyMessage(feed: Feed): string {
  if (feed.total === 0) return "No jobs have been collected yet. Run the collect command, then reload this page."
  if (feed.shown.length === 0) return `All ${feed.total.toLocaleString()} jobs are hidden by your settings and chips. The buttons above show how many each reason hides.`
  return "No job matches the search, menus and chips above."
}

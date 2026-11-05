// The feed page's script: loads the feed from the local server, draws the cards and filters, and saves status changes.
import type { AppliedEntry, ApplicationStatus } from "../feed/applied"
import type { Card } from "../feed/card"
import { filterCards, type PageFilters } from "./filterCards"
import { localDate, renderCard } from "./renderCard"

type Feed = { total: number; shown: Card[]; hidden: { reason: string; count: number }[]; extra: Card[]; applied: AppliedEntry[] }

const SAVED_FILTERS = "job-feed-filters"
const DEFAULT_FILTERS: PageFilters = { search: "", effect: "any", status: "any", sort: "score" }

let feed: Feed = { total: 0, shown: [], hidden: [], extra: [], applied: [] }
let showing = ""

// Returns the element with the given id; the page's HTML always has it.
function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

// Reads the filters saved in this browser, or the defaults when there are none or storage is blocked.
function savedFilters(): PageFilters {
  try {
    return { ...DEFAULT_FILTERS, ...(JSON.parse(localStorage.getItem(SAVED_FILTERS) ?? "{}") as Partial<PageFilters>) }
  } catch {
    return DEFAULT_FILTERS
  }
}

// Reads the filter controls and remembers them in this browser.
function currentFilters(): PageFilters {
  const filters: PageFilters = {
    search: byId<HTMLInputElement>("search").value,
    effect: byId<HTMLSelectElement>("effect").value as PageFilters["effect"],
    status: byId<HTMLSelectElement>("status").value as PageFilters["status"],
    sort: byId<HTMLSelectElement>("sort").value as PageFilters["sort"],
  }
  try {
    localStorage.setItem(SAVED_FILTERS, JSON.stringify(filters))
  } catch {
    // Storage can be blocked; the filters then simply start fresh next time.
  }
  return filters
}

// Sends a status change to the server and redraws with the saved history. Clearing a status asks first.
async function changeStatus(card: Card, status: ApplicationStatus | "none"): Promise<void> {
  const tracked = feed.applied.some((entry) => entry.key === card.key)
  if (status === "none" && tracked && !confirm(`Stop tracking "${card.title}"? Its dates will be removed.`)) return draw()

  const answer = await fetch("/api/applied", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: card.key, status }) })
  const body = (await answer.json()) as { applied?: AppliedEntry[]; error?: string }
  if (!answer.ok || !body.applied) {
    alert(body.error ?? "The status could not be saved.")
    return draw()
  }
  feed.applied = body.applied
  draw()
}

// Draws a list of cards into a container.
function drawCards(container: HTMLElement, cards: readonly Card[]): void {
  const applied = new Map(feed.applied.map((entry) => [entry.key, entry]))
  container.replaceChildren(...cards.map((card) => renderCard(card, applied.get(card.key), (status) => void changeStatus(card, status))))
}

// Draws the summary line with a button per hidden reason that shows those jobs below the feed.
function drawSummary(count: number): void {
  const summary = byId("summary")
  summary.replaceChildren(`Showing ${count.toLocaleString()} of ${feed.total.toLocaleString()} jobs. Hidden: `)
  for (const { reason, count: hidden } of feed.hidden) {
    const button = document.createElement("button")
    button.textContent = `${reason} ${hidden.toLocaleString()}`
    button.addEventListener("click", () => void load(reason === showing ? "" : reason))
    summary.append(button, " ")
  }
}

// Draws the history of tracked jobs, including ones whose posting is no longer listed.
function drawHistory(): void {
  const listed = new Set([...feed.shown, ...feed.extra].map((card) => card.key))
  const rows = feed.applied.map((entry) => {
    const row = document.createElement("li")
    const when = entry.changes.map((change) => `${change.status} ${localDate(change.date)}`).join(", ")
    row.textContent = `${entry.title} at ${entry.company}: ${entry.status}${when ? ` (${when})` : ""}${listed.has(entry.key) ? "" : " · no longer listed"}`
    return row
  })
  byId("history").replaceChildren(...rows)
}

// Redraws everything from the loaded feed and the current filters.
function draw(): void {
  const cards = filterCards(feed.shown, currentFilters(), feed.applied)
  drawSummary(cards.length)
  drawCards(byId("cards"), cards)
  byId("extra-title").textContent = showing ? `Hidden as ${showing} (at most 300 shown)` : ""
  drawCards(byId("extra"), feed.extra)
  drawHistory()
}

// Loads the feed from the server, with the hidden jobs for one reason when asked, and draws it.
async function load(show: string): Promise<void> {
  showing = show
  const answer = await fetch(`/api/feed${show ? `?show=${encodeURIComponent(show)}` : ""}`)
  feed = (await answer.json()) as Feed
  draw()
}

const filters = savedFilters()
byId<HTMLInputElement>("search").value = filters.search
byId<HTMLSelectElement>("effect").value = filters.effect
byId<HTMLSelectElement>("status").value = filters.status
byId<HTMLSelectElement>("sort").value = filters.sort
for (const id of ["search", "effect", "status", "sort"]) byId(id).addEventListener("input", draw)
void load("")

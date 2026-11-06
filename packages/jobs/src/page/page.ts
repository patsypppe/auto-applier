// The feed page's script: loads the feed from the local server with the chosen filter chips, draws the chips, cards and
// filters, marks what is new since the last visit and where STEM OPT can work, and saves status changes and settings.
import type { AppliedEntry, ApplicationStatus } from "../feed/applied"
import type { Card } from "../feed/card"
import { choicesFrom, PAGE_ONLY, renderChips, type ChipChoices, type ChipFilters } from "./chips"
import { filterCards, isNewSince, type PageFilters } from "./filterCards"
import { localDate, renderCard } from "./renderCard"
import { renderSettingsForm, type SettingsDraft } from "./settingsForm"
import { nextVisits, type Visits } from "./visits"
import type { FeedSettings } from "../settings"

type Feed = {
  needsSettings?: boolean
  total: number
  shown: Card[]
  hidden: { reason: string; count: number }[]
  extra: Card[]
  applied: AppliedEntry[]
  filters?: ChipFilters
  stemOpt?: boolean
}

const SAVED_FILTERS = "job-feed-filters"
const SAVED_CHIPS = "job-feed-chips"
const SAVED_VISITS = "job-feed-visits"
const DEFAULT_FILTERS: Omit<PageFilters, "newOnly" | "eVerifyOnly"> = { search: "", effect: "any", status: "any", sort: "score" }

let feed: Feed = { total: 0, shown: [], hidden: [], extra: [], applied: [] }
let showing = ""
let chips: Partial<ChipChoices> = readStored<Partial<ChipChoices>>(SAVED_CHIPS, {})
let lastVisit: string | undefined

// Reads a value saved in this browser, or the fallback when there is none or storage is blocked.
function readStored<T>(key: string, fallback: T): T {
  try {
    const text = localStorage.getItem(key)
    return text === null ? fallback : (JSON.parse(text) as T)
  } catch {
    return fallback
  }
}

// Saves a value in this browser; storage can be blocked, and the page then simply starts fresh next time.
function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to do: the choice lasts until the page is closed.
  }
}

// Returns the element with the given id; the page's HTML always has it.
function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

// Returns the page's own chips: "new only", "E-Verify only" (which counts only when the STEM OPT rule applies) and that rule.
function pageChips(): { newOnly: boolean; eVerifyOnly: boolean; stemOpt: boolean } {
  const stemOpt = feed.stemOpt === true
  return { newOnly: chips.newOnly === "true", eVerifyOnly: stemOpt && chips.eVerifyOnly === "true", stemOpt }
}

// Reads the filter controls and the page's own chips, and remembers the controls in this browser.
function currentFilters(): PageFilters {
  const filters = {
    search: byId<HTMLInputElement>("search").value,
    effect: byId<HTMLSelectElement>("effect").value as PageFilters["effect"],
    status: byId<HTMLSelectElement>("status").value as PageFilters["status"],
    sort: byId<HTMLSelectElement>("sort").value as PageFilters["sort"],
  }
  store(SAVED_FILTERS, filters)
  const { newOnly, eVerifyOnly } = pageChips()
  return { ...filters, newOnly, eVerifyOnly }
}

// Keeps the chips the user changed, compared with the filters the server used, so the rest follow settings.json. Reloads
// the feed when a server filter changed, or only redraws when just the page's own chips did.
function changeChips(choices: ChipChoices): void {
  if (!feed.filters) return
  const before = choicesFrom(feed.filters, pageChips())
  const changed = Object.entries(choices).filter(([name, value]) => value !== before[name as keyof ChipChoices])
  chips = { ...chips, ...Object.fromEntries(changed) }
  store(SAVED_CHIPS, chips)
  if (changed.some(([name]) => !PAGE_ONLY.includes(name as keyof ChipChoices))) void load(showing)
  else draw()
}

// Draws the chips row from the filters the server used.
function drawChips(): void {
  if (!feed.filters) return
  byId("chips").replaceChildren(renderChips(feed.filters, pageChips(), changeChips))
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

// Draws a list of cards into a container, marking the ones first seen since the last visit and, for a user the STEM OPT
// rule applies to, the E-Verify employers.
function drawCards(container: HTMLElement, cards: readonly Card[]): void {
  const applied = new Map(feed.applied.map((entry) => [entry.key, entry]))
  container.replaceChildren(
    ...cards.map((card) => renderCard(card, applied.get(card.key), (status) => void changeStatus(card, status), { isNew: isNewSince(card, lastVisit), stemOpt: feed.stemOpt })),
  )
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

// Sends the settings to the server, which saves them and ranks the jobs again, then reloads the feed and the panel.
// Returns the server's mistakes, one per line, when it refused them.
async function saveSettings(draft: SettingsDraft): Promise<string | undefined> {
  const answer = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
  const body = (await answer.json()) as { settings?: FeedSettings; error?: string }
  if (!answer.ok || !body.settings) return body.error ?? "The settings could not be saved."
  drawSettings(body.settings)
  await load(showing)
  return undefined
}

// Draws the settings panel from the saved settings, or empty for a first setup.
function drawSettings(saved: FeedSettings | undefined): void {
  byId("settings").replaceChildren(renderSettingsForm(saved, saveSettings))
}

// Redraws everything from the loaded feed and the current filters. With no settings yet, it opens the settings panel.
function draw(): void {
  if (feed.needsSettings) {
    byId<HTMLDetailsElement>("settings-panel").open = true
    byId("summary").textContent = `${feed.total.toLocaleString()} jobs are ready. Fill in the settings above to see the ones for you.`
    return
  }
  const cards = filterCards(feed.shown, currentFilters(), feed.applied, lastVisit)
  drawChips()
  drawSummary(cards.length)
  drawCards(byId("cards"), cards)
  byId("extra-title").textContent = showing ? `Hidden as ${showing} (at most 300 shown)` : ""
  drawCards(byId("extra"), feed.extra)
  drawHistory()
}

// Loads the feed from the server with the chosen chips, and the hidden jobs for one reason when asked, and draws it.
// Chips the server refuses, saved by an older page, are dropped and the feed is loaded without them.
async function load(show: string): Promise<void> {
  showing = show
  const params = new URLSearchParams(Object.entries(chips).filter(([name, value]) => !PAGE_ONLY.includes(name as keyof ChipChoices) && value !== undefined) as [string, string][])
  if (show) params.set("show", show)
  const answer = await fetch(`/api/feed?${params}`)
  const body = (await answer.json()) as Feed & { error?: string }
  if (answer.status === 400 && Object.keys(chips).length > 0) {
    chips = {}
    store(SAVED_CHIPS, chips)
    return load(show)
  }
  feed = body
  draw()
}

const visits = nextVisits(readStored<Visits | undefined>(SAVED_VISITS, undefined), new Date().toISOString())
store(SAVED_VISITS, visits)
lastVisit = visits.previous

const filters = { ...DEFAULT_FILTERS, ...readStored<Partial<PageFilters>>(SAVED_FILTERS, {}) }
byId<HTMLInputElement>("search").value = filters.search
byId<HTMLSelectElement>("effect").value = filters.effect
byId<HTMLSelectElement>("status").value = filters.status
byId<HTMLSelectElement>("sort").value = filters.sort
for (const id of ["search", "effect", "status", "sort"]) byId(id).addEventListener("input", draw)
void fetch("/api/settings")
  .then((answer) => answer.json() as Promise<{ settings: FeedSettings | null }>)
  .then(({ settings }) => drawSettings(settings ?? undefined))
void load("")

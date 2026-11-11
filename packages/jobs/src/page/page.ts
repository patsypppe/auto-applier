// The feed page's script: loads the feed from the local server with the chosen filter chips, draws the chips, cards and
// filters, marks what is new since the last visit and where STEM OPT can work, and saves status changes and settings.
// A load or save that fails leaves the page as it was and says what went wrong.
import type { ApplicationStatus } from "../feed/applied"
import type { Card } from "../feed/card"
import type { FeedSettings } from "../settings"
import { choicesFrom, PAGE_ONLY, renderChips, withoutPanelChips, type ChipChoices } from "./chips"
import { cleanChips, cleanFilters, cleanVisits, emptyMessage, hasApplied, hasSettings, isFeed, type Feed } from "./feedState"
import { filterCards, isNewSince, type PageFilters } from "./filterCards"
import { localDate, renderCard } from "./renderCard"
import { readAnswer } from "./requests"
import { renderSettingsForm, type SettingsDraft } from "./settingsForm"
import { nextVisits } from "./visits"
import { whyHidden } from "./whyHidden"

const SAVED_FILTERS = "job-feed-filters"
const SAVED_CHIPS = "job-feed-chips"
const SAVED_VISITS = "job-feed-visits"
const DEFAULT_FILTERS: Omit<PageFilters, "newOnly" | "eVerifyOnly"> = { search: "", effect: "any", status: "any", sort: "score" }

let feed: Feed = { total: 0, shown: [], hidden: [], extra: [], applied: [] }
let loaded = false
let showing = ""
let chips: Partial<ChipChoices> = cleanChips(readStored(SAVED_CHIPS))
let lastVisit: string | undefined
let latestLoad = 0
let statusSaves = 0

// Reads a value saved in this browser, or undefined when there is none, it is not JSON, or storage is blocked.
function readStored(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text === null ? undefined : JSON.parse(text)
  } catch {
    return undefined
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

// Sends JSON to the server with this session's token, which the server wrote into the page, so it knows the request
// comes from this page and not from another site.
function postJson(path: string, body: unknown): Promise<Response> {
  const token = document.querySelector<HTMLMetaElement>('meta[name="feed-token"]')?.content ?? ""
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Feed-Token": token }, body: JSON.stringify(body) })
}

// Returns the element with the given id; the page's HTML always has it.
function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

// Shows a sentence about what went wrong over the summary, or hides the line when given none.
function showProblem(text: string | undefined): void {
  const line = byId("problem")
  line.textContent = text ?? ""
  line.hidden = text === undefined
}

// Sets a menu to a stored value when the menu still has it, and to the fallback otherwise.
function chooseOption(select: HTMLSelectElement, value: string | undefined, fallback: string): void {
  select.value = value ?? fallback
  if (select.value !== value) select.value = fallback
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

// Sends a status change to the server and redraws with the saved history. Clearing a status asks first. When the save
// fails, the menu goes back to the saved status and the page says why.
async function changeStatus(card: Card, status: ApplicationStatus | "none"): Promise<void> {
  const tracked = feed.applied.some((entry) => entry.key === card.key)
  if (status === "none" && tracked && !confirm(`Stop tracking "${card.title}"? Its dates will be removed.`)) return draw()

  const answer = await readAnswer(postJson("/api/applied", { key: card.key, status }), hasApplied, "The status could not be saved")
  if (!answer.ok) {
    showProblem(answer.error)
    return draw()
  }
  statusSaves += 1
  feed = { ...feed, applied: answer.body.applied }
  showProblem(undefined)
  draw()
}

// Draws a list of cards into a container, marking the ones first seen since the last visit and, for a user the STEM OPT
// rule applies to, the E-Verify employers. An empty list shows the sentence given for it, if any, and hidden cards say
// why they were hidden.
function drawCards(container: HTMLElement, cards: readonly Card[], whenEmpty?: string, why?: string): void {
  const applied = new Map(feed.applied.map((entry) => [entry.key, entry]))
  if (cards.length === 0 && whenEmpty) {
    const line = document.createElement("p")
    line.className = "empty"
    line.textContent = whenEmpty
    return container.replaceChildren(line)
  }
  container.replaceChildren(
    ...cards.map((card) => renderCard(card, applied.get(card.key), (status) => void changeStatus(card, status), { isNew: isNewSince(card, lastVisit), stemOpt: feed.stemOpt, why })),
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

// Sends the settings to the server, which saves them and ranks the jobs again, then reloads the feed and the panel. The
// chips for values the panel saves are cleared, so the save takes effect. Returns the server's mistakes, one per line,
// when it refused them.
async function saveSettings(draft: SettingsDraft): Promise<string | undefined> {
  const answer = await readAnswer(postJson("/api/settings", draft), hasSettings, "The settings could not be saved")
  if (!answer.ok) return answer.error
  chips = withoutPanelChips(chips)
  store(SAVED_CHIPS, chips)
  drawSettings(answer.body.settings ?? undefined)
  await load(showing)
  return undefined
}

// Draws the settings panel from the saved settings, or empty for a first setup.
function drawSettings(saved: FeedSettings | undefined): void {
  byId("settings").replaceChildren(renderSettingsForm(saved, saveSettings))
}

// Redraws everything from the loaded feed and the current filters. With no settings yet, it opens the settings panel.
// Before any feed has loaded, it only says so.
function draw(): void {
  if (!loaded) {
    byId("summary").textContent = "The feed has not loaded."
    return
  }
  if (feed.needsSettings) {
    byId<HTMLDetailsElement>("settings-panel").open = true
    byId("summary").textContent = `${feed.total.toLocaleString()} jobs are ready. Fill in the settings above to see the ones for you.`
    return
  }
  const cards = filterCards(feed.shown, currentFilters(), feed.applied, lastVisit)
  drawChips()
  drawSummary(cards.length)
  drawCards(byId("cards"), cards, emptyMessage(feed))
  byId("extra-title").textContent = showing ? `Hidden as ${showing} (at most 300 shown)` : ""
  drawCards(byId("extra"), feed.extra, undefined, showing && feed.filters ? whyHidden(showing, feed.filters, chips) : undefined)
  drawHistory()
}

// Loads the feed from the server with the chosen chips, and the hidden jobs for one reason when asked, and draws it.
// Only the latest load is drawn; an older answer that arrives later is dropped. A status saved while the load was on its
// way is kept over the history in the answer. Chips the server refuses, saved by an older page, are dropped and the feed
// is loaded without them. When the load fails, the feed on screen stays and the page says why.
async function load(show: string): Promise<void> {
  const ticket = ++latestLoad
  const savesBefore = statusSaves
  const params = new URLSearchParams(Object.entries(chips).filter(([name, value]) => !PAGE_ONLY.includes(name as keyof ChipChoices) && value !== undefined) as [string, string][])
  if (show) params.set("show", show)
  const answer = await readAnswer(fetch(`/api/feed?${params}`), isFeed, "The feed could not be loaded")
  if (ticket !== latestLoad) return
  if (!answer.ok && answer.status === 400 && Object.keys(chips).length > 0) {
    chips = {}
    store(SAVED_CHIPS, chips)
    return load(show)
  }
  if (!answer.ok) {
    showProblem(answer.error)
    return draw()
  }
  feed = statusSaves === savesBefore ? answer.body : { ...answer.body, applied: feed.applied }
  loaded = true
  showing = show
  showProblem(undefined)
  draw()
}

// Opens or closes the search, menus and chips. On a narrow screen they start folded, so the first job shows without
// scrolling; on a wide one the button is hidden and they always show.
function toggleFilters(): void {
  const toggle = byId("filters-toggle")
  const open = toggle.getAttribute("aria-expanded") !== "true"
  toggle.setAttribute("aria-expanded", String(open))
  byId("filters").classList.toggle("open", open)
}

// Fills the settings panel from the server; when that fails, the panel stays empty so blank settings cannot be saved
// over the real ones, and the page says why.
async function loadSettings(): Promise<void> {
  const answer = await readAnswer(fetch("/api/settings"), hasSettings, "The settings could not be loaded")
  if (answer.ok) drawSettings(answer.body.settings ?? undefined)
  else showProblem(answer.error)
}

const visits = nextVisits(cleanVisits(readStored(SAVED_VISITS)), new Date().toISOString())
store(SAVED_VISITS, visits)
lastVisit = visits.previous

const filters = cleanFilters(readStored(SAVED_FILTERS))
byId<HTMLInputElement>("search").value = filters.search ?? DEFAULT_FILTERS.search
chooseOption(byId("effect"), filters.effect, DEFAULT_FILTERS.effect)
chooseOption(byId("status"), filters.status, DEFAULT_FILTERS.status)
chooseOption(byId("sort"), filters.sort, DEFAULT_FILTERS.sort)
for (const id of ["search", "effect", "status", "sort"]) byId(id).addEventListener("input", draw)
byId("filters-toggle").addEventListener("click", toggleFilters)
void loadSettings()
void load("")

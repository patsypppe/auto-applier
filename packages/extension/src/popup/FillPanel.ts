// Renders the "Fill this page", "Fill and continue" and "Stop" buttons and shows the progress, saved results and notes of the page's frames, also after the popup is reopened.
import { formatSummary } from "@auto-applier/core"
import type { FillPhase, ReportSummary } from "@auto-applier/core"
import { combineProgress } from "../fill/combineProgress"
import { combineResults } from "../fill/combineResults"
import type { FillAndContinueRequest, FillPageRequest, StopFlowRequest } from "../messaging"
import type { ChromeSessionFillStore, FillRun } from "../storage/ChromeSessionFillStore"

const UNREACHABLE_MESSAGE = "Could not reach this page. Reload the tab and try again."

// Returns the id of the tab the popup was opened on, if there is one.
async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

type TabRequest = FillPageRequest | FillAndContinueRequest | StopFlowRequest

// Sends the request to every frame of the tab.
async function sendToTab(tabId: number, request: TabRequest): Promise<void> {
  await chrome.tabs.sendMessage(tabId, request)
}

const PHASE_LABELS: Record<FillPhase, string> = {
  rules: "filling fields…",
  reading: "reading dropdown options…",
  asking: "asking the AI…",
  answering: "filling the AI's answers…",
}

type Bar = { total: number; filled: number; phase?: FillPhase }

// Returns the bar for a finished fill: how many of all its fields were filled or drafted.
function barFromSummary(summary: ReportSummary): Bar | undefined {
  const filled = summary.filled + summary.aiFilled + summary.drafted
  const total = filled + summary.skipped + summary.failed + summary.unmatched + summary.noValue
  return total > 0 ? { total, filled } : undefined
}

// Shows the bar and its caption, or hides them when there is nothing to show.
function showBar(bar: HTMLProgressElement, caption: HTMLElement, shown: Bar | undefined): void {
  bar.hidden = shown === undefined
  caption.hidden = shown === undefined
  if (!shown) return

  bar.max = shown.total
  bar.value = shown.filled
  const count = `${shown.filled} of ${shown.total} filled`
  caption.textContent = shown.phase ? `${count} · ${PHASE_LABELS[shown.phase]}` : count
}

// Replaces the contents of a list element with one item per note.
function showNotes(list: HTMLElement, notes: string[]): void {
  const items = notes.map((note) => {
    const item = document.createElement("li")
    item.textContent = note
    return item
  })
  list.replaceChildren(...items)
}

// Adds the buttons, a progress bar, a status line and a notes list to the container, shows what is saved for the tab, and updates as frames report in.
export async function mountFillPanel(container: HTMLElement, store: ChromeSessionFillStore): Promise<void> {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "Fill this page"

  const continueButton = document.createElement("button")
  continueButton.type = "button"
  continueButton.textContent = "Fill and continue"

  const stopButton = document.createElement("button")
  stopButton.type = "button"
  stopButton.textContent = "Stop"

  const hint = document.createElement("p")
  hint.className = "hint"
  hint.textContent = "Fill and continue presses Next for you between steps but never presses Submit, and stops when it needs you."

  const bar = document.createElement("progress")
  bar.hidden = true

  const caption = document.createElement("p")
  caption.className = "progress-caption"
  caption.hidden = true

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  const notesList = document.createElement("ul")
  notesList.className = "notes"

  container.append(button, continueButton, stopButton, hint, bar, caption, status, notesList)

  const tabId = await activeTabId()
  let failure: string | undefined

  // Shows a run: the failure to start it, the combined result, "Filling…" while waiting, or nothing.
  function render(run: FillRun): void {
    const combined = combineResults(run.results)
    if (failure) status.textContent = failure
    else if (combined.summary) status.textContent = formatSummary(combined.summary)
    else if (combined.error) status.textContent = combined.error
    else status.textContent = run.running ? "Filling…" : ""
    showNotes(notesList, combined.notes)

    if (failure) showBar(bar, caption, undefined)
    else if (combined.summary) showBar(bar, caption, barFromSummary(combined.summary))
    else showBar(bar, caption, run.running ? combineProgress(run.progress) : undefined)
  }

  // Loads what is saved for the tab and shows it.
  async function refresh(): Promise<void> {
    if (tabId !== undefined) render(await store.load(tabId))
  }

  // Marks a run as started and sends the request to the tab; shows a clear message when the page cannot be reached.
  async function startRun(request: FillPageRequest | FillAndContinueRequest): Promise<void> {
    failure = undefined
    try {
      if (tabId === undefined) throw new Error("No active tab")
      await store.start(tabId)
      await sendToTab(tabId, request)
    } catch {
      failure = UNREACHABLE_MESSAGE
      if (tabId !== undefined) await store.clear(tabId).catch(() => undefined)
      render({ running: false, results: [], progress: [] })
    }
  }

  button.addEventListener("click", () => void startRun({ type: "fill-page" }))
  continueButton.addEventListener("click", () => void startRun({ type: "fill-and-continue" }))
  stopButton.addEventListener("click", () => {
    if (tabId !== undefined) void sendToTab(tabId, { type: "stop-flow" }).catch(() => undefined)
  })

  if (tabId === undefined) return
  store.onChange(tabId, () => void refresh())
  await refresh()
}

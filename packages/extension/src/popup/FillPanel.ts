// Renders the "Fill this page" button and shows the saved results and notes of the page's frames, also after the popup is reopened.
import { formatSummary } from "@auto-applier/core"
import { combineResults } from "../fill/combineResults"
import type { FillPageRequest } from "../messaging"
import type { ChromeSessionFillStore, FillRun } from "../storage/ChromeSessionFillStore"

const UNREACHABLE_MESSAGE = "Could not reach this page. Reload the tab and try again."

// Returns the id of the tab the popup was opened on, if there is one.
async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

// Sends the fill request to every frame of the tab.
async function requestFill(tabId: number): Promise<void> {
  const request: FillPageRequest = { type: "fill-page" }
  await chrome.tabs.sendMessage(tabId, request)
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

// Adds the button, a status line and a notes list to the container, shows what is saved for the tab, and updates as frames report in.
export async function mountFillPanel(container: HTMLElement, store: ChromeSessionFillStore): Promise<void> {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "Fill this page"

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  const notesList = document.createElement("ul")
  notesList.className = "notes"

  container.append(button, status, notesList)

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
  }

  // Loads what is saved for the tab and shows it.
  async function refresh(): Promise<void> {
    if (tabId !== undefined) render(await store.load(tabId))
  }

  button.addEventListener("click", async () => {
    failure = undefined
    try {
      if (tabId === undefined) throw new Error("No active tab")
      await store.start(tabId)
      await requestFill(tabId)
    } catch {
      failure = UNREACHABLE_MESSAGE
      if (tabId !== undefined) await store.clear(tabId).catch(() => undefined)
      render({ running: false, results: [] })
    }
  })

  if (tabId === undefined) return
  store.onChange(tabId, () => void refresh())
  await refresh()
}

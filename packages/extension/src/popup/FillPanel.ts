// Renders the "Fill this page" button and shows the running totals and notes reported back by the page's frames.
import { addSummaries, emptySummary, formatSummary } from "@auto-applier/core"
import { isFillResultMessage } from "../messaging"
import type { FillPageRequest } from "../messaging"

// Sends the fill request to every frame of the active tab.
async function requestFill(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id === undefined) throw new Error("No active tab")

  const request: FillPageRequest = { type: "fill-page" }
  await chrome.tabs.sendMessage(tab.id, request)
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

// Adds the button, a status line and a notes list to the container, and updates them as each frame reports in.
export function mountFillPanel(container: HTMLElement): void {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "Fill this page"

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  const notesList = document.createElement("ul")
  notesList.className = "notes"

  let totals = emptySummary()
  let notes: string[] = []

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isFillResultMessage(message)) return

    if (message.result.ok) {
      totals = addSummaries(totals, message.result.summary)
      notes = [...new Set([...notes, ...message.result.notes])]
      status.textContent = formatSummary(totals)
      showNotes(notesList, notes)
    } else {
      status.textContent = message.result.error
    }
  })

  button.addEventListener("click", async () => {
    totals = emptySummary()
    notes = []
    showNotes(notesList, notes)
    status.textContent = "Filling…"
    try {
      await requestFill()
    } catch {
      status.textContent = "Could not reach this page. Reload the tab and try again."
    }
  })

  container.append(button, status, notesList)
}

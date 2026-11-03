// Renders the "Fill this page" button and shows the running totals reported back by the page's frames.
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

// Adds the button and a status line to the container, and updates the status as each frame reports in.
export function mountFillPanel(container: HTMLElement): void {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "Fill this page"

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  let totals = emptySummary()

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isFillResultMessage(message)) return

    if (message.result.ok) {
      totals = addSummaries(totals, message.result.summary)
      status.textContent = formatSummary(totals)
    } else {
      status.textContent = message.result.error
    }
  })

  button.addEventListener("click", async () => {
    totals = emptySummary()
    status.textContent = "Filling…"
    try {
      await requestFill()
    } catch {
      status.textContent = "Could not reach this page. Reload the tab and try again."
    }
  })

  container.append(button, status)
}

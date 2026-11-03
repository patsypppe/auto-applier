// Content script: fills the page from the saved profile when the popup asks, then outlines what needs the user.
import { fillPage, summarizeReports, validateProfile } from "@auto-applier/core"
import { isFillPageRequest } from "./messaging"
import type { FillResultMessage } from "./messaging"
import { ChromeStorageProfileStore } from "./storage/ChromeStorageProfileStore"
import { highlightFlagged } from "./ui/highlightFlagged"

// Wraps an error text in the message the popup expects.
function failure(error: string): FillResultMessage {
  return { type: "fill-result", result: { ok: false, error } }
}

// Fills this frame from the saved profile and returns what happened as a message for the popup.
async function runFill(): Promise<FillResultMessage> {
  try {
    const saved = await new ChromeStorageProfileStore().load()
    if (!saved) return failure("No saved profile yet. Fill in and save the form in this popup first.")

    const checked = validateProfile(saved)
    if (!checked.ok) return failure(`Your saved profile needs fixing: ${checked.errors.join("; ")}`)

    const reports = await fillPage(document, checked.profile)
    highlightFlagged(reports)
    return { type: "fill-result", result: { ok: true, summary: summarizeReports(reports) } }
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : "Filling failed")
  }
}

// Sends the result to the popup; if the popup was closed nobody is listening, which is fine.
function sendToPopup(message: FillResultMessage): void {
  chrome.runtime.sendMessage(message).catch(() => undefined)
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isFillPageRequest(message)) void runFill().then(sendToPopup)
})

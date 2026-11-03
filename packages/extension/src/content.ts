// Content script: fills the page when the popup asks, using the saved profile and the LLM through the background worker.
import { runFill } from "./fill/runFill"
import { BackgroundLLMClient } from "./llm/BackgroundLLMClient"
import { isFillPageRequest } from "./messaging"
import type { FillResultMessage } from "./messaging"
import { ChromeStorageProfileStore } from "./storage/ChromeStorageProfileStore"

// Sends the result to the popup; if the popup was closed nobody is listening, which is fine.
function sendToPopup(message: FillResultMessage): void {
  chrome.runtime.sendMessage(message).catch(() => undefined)
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isFillPageRequest(message)) return
  void runFill(new ChromeStorageProfileStore(), new BackgroundLLMClient()).then(sendToPopup)
})

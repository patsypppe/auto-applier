// Content script: fills the page when the popup asks, using the saved profile and the LLM through the background worker.
import { runFill } from "./fill/runFill"
import { BackgroundLLMClient } from "./llm/BackgroundLLMClient"
import { isFillPageRequest } from "./messaging"
import { loadResumeFromBackground } from "./resume/loadResumeFromBackground"
import type { FillProgressMessage, FillResultMessage, PageLoadedMessage } from "./messaging"
import { ChromeStorageProfileStore } from "./storage/ChromeStorageProfileStore"

// Sends the result to the extension, where the background worker saves it for the popup, open or not.
function reportResult(message: FillResultMessage): void {
  chrome.runtime.sendMessage(message).catch(() => undefined)
}

// Sends how far the fill has got to the extension, where the background worker saves it for the popup's progress bar.
function reportProgress(progress: FillProgressMessage["progress"]): void {
  const message: FillProgressMessage = { type: "fill-progress", progress }
  chrome.runtime.sendMessage(message).catch(() => undefined)
}

// The top page tells the background worker it has loaded, so results saved for the previous page are dropped.
if (window === window.top) {
  const loaded: PageLoadedMessage = { type: "page-loaded" }
  chrome.runtime.sendMessage(loaded).catch(() => undefined)
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isFillPageRequest(message)) return
  void runFill(new ChromeStorageProfileStore(), new BackgroundLLMClient(), loadResumeFromBackground, reportProgress).then(reportResult)
})

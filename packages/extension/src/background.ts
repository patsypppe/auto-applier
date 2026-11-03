// Service worker: answers LLM requests (only this script uses the API keys) and keeps each tab's fill results for the popup.
import { createFallbackClient, createProviderClient } from "@auto-applier/core"
import { answerLlmRequest } from "./llm/answerLlmRequest"
import { isFillResultMessage, isLlmRequest, isPageLoadedMessage } from "./messaging"
import { ChromeSessionFillStore } from "./storage/ChromeSessionFillStore"
import { ChromeStorageSettingsStore } from "./storage/ChromeStorageSettingsStore"

const settingsStore = new ChromeStorageSettingsStore()
const fillStore = new ChromeSessionFillStore()

// Saves fill results and forgets them on page loads (no reply); returns true (keeping the reply channel open) only for LLM requests. Everything is ignored unless it comes from this extension.
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false

  const tabId = sender.tab?.id
  if (isFillResultMessage(message)) {
    if (tabId !== undefined) void fillStore.saveResult(tabId, sender.frameId ?? 0, message.result)
    return false
  }
  if (isPageLoadedMessage(message)) {
    if (tabId !== undefined && (sender.frameId ?? 0) === 0) void fillStore.clear(tabId)
    return false
  }
  if (!isLlmRequest(message)) return false

  void answerLlmRequest(message, settingsStore, { all: createFallbackClient, one: createProviderClient }).then(sendResponse)
  return true
})

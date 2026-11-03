// Service worker: answers LLM requests (only this script uses the API keys) and keeps each tab's fill progress and results for the popup.
import { createFallbackClient, createProviderClient } from "@auto-applier/core"
import { answerLlmRequest } from "./llm/answerLlmRequest"
import { isFillProgressMessage, isFillResultMessage, isGetResumeRequest, isLlmRequest, isPageLoadedMessage } from "./messaging"
import { answerResumeRequest } from "./resume/answerResumeRequest"
import { ChromeSessionFillStore } from "./storage/ChromeSessionFillStore"
import { ChromeStorageSettingsStore } from "./storage/ChromeStorageSettingsStore"
import { IndexedDbResumeStore } from "./storage/IndexedDbResumeStore"

const settingsStore = new ChromeStorageSettingsStore()
const fillStore = new ChromeSessionFillStore()
const resumeStore = new IndexedDbResumeStore()

// Saves fill progress and results and forgets them on page loads (no reply); returns true (keeping the reply channel open) for LLM and resume requests. Everything is ignored unless it comes from this extension.
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false

  const tabId = sender.tab?.id
  if (isFillResultMessage(message)) {
    if (tabId !== undefined) void fillStore.saveResult(tabId, sender.frameId ?? 0, message.result)
    return false
  }
  if (isFillProgressMessage(message)) {
    if (tabId !== undefined) void fillStore.saveProgress(tabId, sender.frameId ?? 0, message.progress)
    return false
  }
  if (isPageLoadedMessage(message)) {
    if (tabId !== undefined && (sender.frameId ?? 0) === 0) void fillStore.clear(tabId)
    return false
  }
  if (isGetResumeRequest(message)) {
    void answerResumeRequest(resumeStore).then(sendResponse)
    return true
  }
  if (!isLlmRequest(message)) return false

  void answerLlmRequest(message, settingsStore, { all: createFallbackClient, one: createProviderClient }).then(sendResponse)
  return true
})

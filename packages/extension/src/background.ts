// Service worker: answers LLM requests from this extension, because only this script uses the API keys.
import { createFallbackClient, createProviderClient } from "@auto-applier/core"
import { answerLlmRequest } from "./llm/answerLlmRequest"
import { isLlmRequest } from "./messaging"
import { ChromeStorageSettingsStore } from "./storage/ChromeStorageSettingsStore"

const settingsStore = new ChromeStorageSettingsStore()

// Returns true (keeping the reply channel open) only for LLM requests that come from this extension.
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !isLlmRequest(message)) return false

  void answerLlmRequest(message, settingsStore, { all: createFallbackClient, one: createProviderClient }).then(sendResponse)
  return true
})

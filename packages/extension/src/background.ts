// Service worker: answers LLM requests (only this script uses the API keys) and keeps each tab's fill progress and results for the popup.
import { createFallbackClient, createProviderClient } from "@auto-applier/core"
import { answerLlmRequest } from "./llm/answerLlmRequest"
import {
  isApplyToLinkRequest,
  isAutopilotClearMessage,
  isAutopilotGetRequest,
  isAutopilotSaveMessage,
  isFillProgressMessage,
  isFillResultMessage,
  isFlowClearMessage,
  isFlowGetRequest,
  isFlowSaveMessage,
  isGetResumeRequest,
  isLlmRequest,
  isPageLoadedMessage,
} from "./messaging"
import { answerResumeRequest } from "./resume/answerResumeRequest"
import { ChromeSessionAutopilotStore } from "./storage/ChromeSessionAutopilotStore"
import { ChromeSessionFillStore } from "./storage/ChromeSessionFillStore"
import { ChromeSessionFlowStore } from "./storage/ChromeSessionFlowStore"
import { ChromeStorageSettingsStore } from "./storage/ChromeStorageSettingsStore"
import { IndexedDbResumeStore } from "./storage/IndexedDbResumeStore"

const settingsStore = new ChromeStorageSettingsStore()
const fillStore = new ChromeSessionFillStore()
const flowStore = new ChromeSessionFlowStore()
const autopilotStore = new ChromeSessionAutopilotStore()
const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:"])
const resumeStore = new IndexedDbResumeStore()

// Returns true when the text is a web address the extension may open.
function isWebAddress(text: string): boolean {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(text).protocol)
  } catch {
    return false
  }
}

// Opens the link in a new tab and starts an apply run in it; replies with ok or why not.
async function startApplyRun(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isWebAddress(url)) return { ok: false, error: "That is not a web address. Use a link that starts with http:// or https://." }

  const tab = await chrome.tabs.create({ url, active: true })
  if (tab.id === undefined) return { ok: false, error: "Could not open a new tab." }

  await autopilotStore.save(tab.id, { startedAt: Date.now(), url, applyClicks: 0 })
  await fillStore.start(tab.id)
  return { ok: true }
}

// A tab opened by a tab that is running an apply run carries the run on (an Apply link that opens the form in a new tab).
chrome.tabs.onCreated.addListener((tab) => {
  const opener = tab.openerTabId
  if (tab.id === undefined || opener === undefined) return

  const newTabId = tab.id
  void autopilotStore.load(opener).then(async (state) => {
    if (!state) return
    await autopilotStore.save(newTabId, state)
    await fillStore.start(newTabId)
  })
})

// Saves fill progress, results and flow state and forgets results on page loads (no reply); returns true (keeping the reply channel open) for LLM, resume and flow-state requests. Everything is ignored unless it comes from this extension.
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
    if (tabId !== undefined && (sender.frameId ?? 0) === 0) {
      void autopilotStore.load(tabId).then((run) => (run ? undefined : fillStore.clear(tabId)))
    }
    return false
  }
  if (isFlowSaveMessage(message)) {
    if (tabId !== undefined) void flowStore.save(tabId, sender.frameId ?? 0, message.state)
    return false
  }
  if (isFlowClearMessage(message)) {
    if (tabId !== undefined) void flowStore.clear(tabId, sender.frameId ?? 0)
    return false
  }
  if (isFlowGetRequest(message)) {
    const state = tabId === undefined ? Promise.resolve(undefined) : flowStore.load(tabId, sender.frameId ?? 0)
    void state.then((found) => sendResponse(found ? { state: found } : {}))
    return true
  }
  if (isApplyToLinkRequest(message)) {
    if (tabId !== undefined) return false
    void startApplyRun(message.url).then(sendResponse)
    return true
  }
  if (isAutopilotSaveMessage(message)) {
    if (tabId !== undefined) void autopilotStore.save(tabId, message.state)
    return false
  }
  if (isAutopilotClearMessage(message)) {
    if (tabId !== undefined) void autopilotStore.clear(tabId)
    return false
  }
  if (isAutopilotGetRequest(message)) {
    const run = tabId === undefined ? Promise.resolve(undefined) : autopilotStore.load(tabId)
    void run.then((found) => sendResponse(found ? { state: found } : {}))
    return true
  }
  if (isGetResumeRequest(message)) {
    void answerResumeRequest(resumeStore).then(sendResponse)
    return true
  }
  if (!isLlmRequest(message)) return false

  void answerLlmRequest(message, settingsStore, { all: createFallbackClient, one: createProviderClient }).then(sendResponse)
  return true
})

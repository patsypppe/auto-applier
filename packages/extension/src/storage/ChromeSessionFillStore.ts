// Keeps each tab's fill results in chrome.storage.session, so the popup can show them again after it is closed and reopened.
import { isFillResultMessage } from "../messaging"
import type { FrameResult } from "../fill/combineResults"

const RUN_PREFIX = "fill-run:"
const RESULT_PREFIX = "fill-result:"

export type FillRun = {
  running: boolean
  results: FrameResult[]
}

// Returns the key that marks a tab as having a fill in progress.
function runKey(tabId: number): string {
  return `${RUN_PREFIX}${tabId}`
}

// Returns the start of every key holding one frame's result for the tab.
function resultPrefix(tabId: number): string {
  return `${RESULT_PREFIX}${tabId}:`
}

// Returns true when the storage key belongs to the tab.
function belongsToTab(key: string, tabId: number): boolean {
  return key === runKey(tabId) || key.startsWith(resultPrefix(tabId))
}

export class ChromeSessionFillStore {
  // Forgets the tab's old results and marks a new fill as running.
  async start(tabId: number): Promise<void> {
    await this.clear(tabId)
    await chrome.storage.session.set({ [runKey(tabId)]: { startedAt: Date.now() } })
  }

  // Saves what one frame of the tab reported.
  async saveResult(tabId: number, frameId: number, result: FrameResult): Promise<void> {
    await chrome.storage.session.set({ [`${resultPrefix(tabId)}${frameId}`]: result })
  }

  // Forgets everything saved for the tab.
  async clear(tabId: number): Promise<void> {
    const stored = await chrome.storage.session.get(null)
    const keys = Object.keys(stored).filter((key) => belongsToTab(key, tabId))
    if (keys.length > 0) await chrome.storage.session.remove(keys)
  }

  // Returns whether a fill is in progress and the valid results saved for the tab, in frame order.
  async load(tabId: number): Promise<FillRun> {
    const stored = await chrome.storage.session.get(null)
    const prefix = resultPrefix(tabId)

    const results = Object.keys(stored)
      .filter((key) => key.startsWith(prefix))
      .sort((first, second) => Number(first.slice(prefix.length)) - Number(second.slice(prefix.length)))
      .map((key) => stored[key])
      .filter((value): value is FrameResult => isFillResultMessage({ type: "fill-result", result: value }))

    return { running: runKey(tabId) in stored, results }
  }

  // Calls the listener whenever the tab's saved data changes, and returns a function that stops the calls.
  onChange(tabId: number, listener: () => void): () => void {
    const handler = (changes: Record<string, unknown>, areaName: string): void => {
      if (areaName === "session" && Object.keys(changes).some((key) => belongsToTab(key, tabId))) listener()
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }
}

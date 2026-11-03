// Keeps each tab's fill results in chrome.storage.session, so the popup can show them again after it is closed and reopened.
import { isFillProgress } from "@auto-applier/core"
import type { FillProgress } from "@auto-applier/core"
import { isFillResultMessage } from "../messaging"
import type { FrameResult } from "../fill/combineResults"

const RUN_PREFIX = "fill-run:"
const RESULT_PREFIX = "fill-result:"
const PROGRESS_PREFIX = "fill-progress:"

export type FillRun = {
  running: boolean
  results: FrameResult[]
  progress: FillProgress[]
}

// Returns the key that marks a tab as having a fill in progress.
function runKey(tabId: number): string {
  return `${RUN_PREFIX}${tabId}`
}

// Returns the start of every key holding one frame's result for the tab.
function resultPrefix(tabId: number): string {
  return `${RESULT_PREFIX}${tabId}:`
}

// Returns the start of every key holding one frame's progress for the tab.
function progressPrefix(tabId: number): string {
  return `${PROGRESS_PREFIX}${tabId}:`
}

// Returns true when the storage key belongs to the tab.
function belongsToTab(key: string, tabId: number): boolean {
  return key === runKey(tabId) || key.startsWith(resultPrefix(tabId)) || key.startsWith(progressPrefix(tabId))
}

// Returns the values stored under the prefix, in the order of the frame ids that end each key.
function valuesInFrameOrder(stored: Record<string, unknown>, prefix: string): unknown[] {
  return Object.keys(stored)
    .filter((key) => key.startsWith(prefix))
    .sort((first, second) => Number(first.slice(prefix.length)) - Number(second.slice(prefix.length)))
    .map((key) => stored[key])
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

  // Saves how far one frame of the tab has got, replacing its earlier progress.
  async saveProgress(tabId: number, frameId: number, progress: FillProgress): Promise<void> {
    await chrome.storage.session.set({ [`${progressPrefix(tabId)}${frameId}`]: progress })
  }

  // Forgets everything saved for the tab.
  async clear(tabId: number): Promise<void> {
    const stored = await chrome.storage.session.get(null)
    const keys = Object.keys(stored).filter((key) => belongsToTab(key, tabId))
    if (keys.length > 0) await chrome.storage.session.remove(keys)
  }

  // Returns whether a fill is in progress and the valid results and progress saved for the tab, in frame order.
  async load(tabId: number): Promise<FillRun> {
    const stored = await chrome.storage.session.get(null)

    const results = valuesInFrameOrder(stored, resultPrefix(tabId)).filter((value): value is FrameResult =>
      isFillResultMessage({ type: "fill-result", result: value }),
    )
    const progress = valuesInFrameOrder(stored, progressPrefix(tabId)).filter(isFillProgress)

    return { running: runKey(tabId) in stored, results, progress }
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

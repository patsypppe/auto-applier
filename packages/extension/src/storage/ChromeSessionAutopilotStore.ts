// Keeps each tab's apply-by-link run in chrome.storage.session, so the pages the run passes through can carry it on.
import { isAutopilotResponse } from "../messaging"
import type { AutopilotState } from "../messaging"

export const AUTOPILOT_LIFETIME_MS = 10 * 60 * 1000

// Returns the key that holds one tab's run.
function keyFor(tabId: number): string {
  return `autopilot:${tabId}`
}

export class ChromeSessionAutopilotStore {
  // Remembers the run of a tab.
  async save(tabId: number, state: AutopilotState): Promise<void> {
    await chrome.storage.session.set({ [keyFor(tabId)]: state })
  }

  // Returns the tab's run, or undefined when there is none, it is not well formed, or it is older than its lifetime (then it is forgotten).
  async load(tabId: number, now: number = Date.now()): Promise<AutopilotState | undefined> {
    const key = keyFor(tabId)
    const stored = (await chrome.storage.session.get(key))[key]
    if (stored === undefined || !isAutopilotResponse({ state: stored })) return undefined

    const state = stored as AutopilotState
    if (now - state.startedAt <= AUTOPILOT_LIFETIME_MS) return state

    await this.clear(tabId)
    return undefined
  }

  // Forgets the tab's run.
  async clear(tabId: number): Promise<void> {
    await chrome.storage.session.remove(keyFor(tabId))
  }
}

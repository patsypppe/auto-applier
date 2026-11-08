// Keeps how far each frame's Next-button flow has got in chrome.storage.session, so a flow can carry on after the page reloads.
import { isFlowStateResponse } from "../messaging"
import type { FlowState } from "../messaging"

// Returns the key that holds one frame's flow state.
function keyFor(tabId: number, frameId: number): string {
  return `flow:${tabId}:${frameId}`
}

export class ChromeSessionFlowStore {
  // Remembers the flow state of one frame of a tab.
  async save(tabId: number, frameId: number, state: FlowState): Promise<void> {
    await chrome.storage.session.set({ [keyFor(tabId, frameId)]: state })
  }

  // Returns the saved flow state of a frame, or undefined when there is none or it is not well formed.
  async load(tabId: number, frameId: number): Promise<FlowState | undefined> {
    const key = keyFor(tabId, frameId)
    const stored = (await chrome.storage.session.get(key))[key]
    return stored !== undefined && isFlowStateResponse({ state: stored }) ? (stored as FlowState) : undefined
  }

  // Forgets the flow state of a frame.
  async clear(tabId: number, frameId: number): Promise<void> {
    await chrome.storage.session.remove(keyFor(tabId, frameId))
  }
}

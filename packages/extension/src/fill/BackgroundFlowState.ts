// Saves, reads and clears a content script's flow state by messaging the background worker, which keeps it per tab and frame.
import { isFlowStateResponse } from "../messaging"
import type { FlowClearMessage, FlowGetRequest, FlowSaveMessage, FlowState } from "../messaging"
import type { FlowStatePort } from "./flowState"

export class BackgroundFlowState implements FlowStatePort {
  // Asks the worker to remember the state.
  async save(state: FlowState): Promise<void> {
    const message: FlowSaveMessage = { type: "flow-save", state }
    await chrome.runtime.sendMessage(message)
  }

  // Asks the worker for the remembered state; anything unclear counts as no state.
  async load(): Promise<FlowState | undefined> {
    const request: FlowGetRequest = { type: "flow-get" }
    const reply: unknown = await chrome.runtime.sendMessage(request)
    return isFlowStateResponse(reply) ? reply.state : undefined
  }

  // Asks the worker to forget the state.
  async clear(): Promise<void> {
    const message: FlowClearMessage = { type: "flow-clear" }
    await chrome.runtime.sendMessage(message)
  }
}

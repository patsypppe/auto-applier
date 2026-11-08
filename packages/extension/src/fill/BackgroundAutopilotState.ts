// Reads, saves and clears a content script's apply-by-link run by messaging the background worker, which keeps it per tab.
import { isAutopilotResponse } from "../messaging"
import type { AutopilotClearMessage, AutopilotGetRequest, AutopilotSaveMessage, AutopilotState } from "../messaging"
import type { AutopilotPort } from "./autopilotState"

export class BackgroundAutopilotState implements AutopilotPort {
  // Asks the worker for the tab's run; anything unclear, or no worker, counts as no run.
  async load(): Promise<AutopilotState | undefined> {
    const request: AutopilotGetRequest = { type: "autopilot-get" }
    try {
      const reply: unknown = await chrome.runtime.sendMessage(request)
      return isAutopilotResponse(reply) ? reply.state : undefined
    } catch {
      return undefined
    }
  }

  // Asks the worker to remember the run.
  async save(state: AutopilotState): Promise<void> {
    const message: AutopilotSaveMessage = { type: "autopilot-save", state }
    await chrome.runtime.sendMessage(message)
  }

  // Asks the worker to forget the run.
  async clear(): Promise<void> {
    const message: AutopilotClearMessage = { type: "autopilot-clear" }
    await chrome.runtime.sendMessage(message)
  }
}

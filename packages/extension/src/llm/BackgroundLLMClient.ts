// Runs LLM calls by asking the background worker, so the API key never leaves the worker.
import type { LLMClient } from "@auto-applier/core"
import { isLlmResponse } from "../messaging"
import type { LlmRequest } from "../messaging"

export class BackgroundLLMClient implements LLMClient {
  // Sends the prompt to the background worker and returns its answer, or throws the reason it failed.
  async completeJson(prompt: string): Promise<unknown> {
    const request: LlmRequest = { type: "llm-complete", prompt }

    let reply: unknown
    try {
      reply = await chrome.runtime.sendMessage(request)
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "unknown error"
      throw new Error(`Could not reach the extension's background worker: ${reason}`)
    }

    if (!isLlmResponse(reply)) throw new Error("The background worker sent an unexpected reply")
    if (!reply.ok) throw new Error(reply.error)
    return reply.data
  }
}

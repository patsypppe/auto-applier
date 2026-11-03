// Answers one LLM request: loads the saved settings, builds a client and returns the answer or the reason it failed.
import type { LLMClient, LLMSettings, SettingsStore } from "@auto-applier/core"
import type { LlmRequest, LlmResponse } from "../messaging"

const NO_KEY_ERROR = "No Gemini API key is set. Add one in the extension's LLM settings."

// Runs the prompt through a client built from the saved settings; every failure becomes a failed reply.
export async function answerLlmRequest(
  request: LlmRequest,
  store: SettingsStore,
  createClient: (settings: LLMSettings) => LLMClient,
): Promise<LlmResponse> {
  try {
    const settings = await store.load()
    if (!settings) return { ok: false, error: NO_KEY_ERROR }

    const data = await createClient(settings).completeJson(request.prompt)
    return { ok: true, data }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "The LLM request failed" }
  }
}

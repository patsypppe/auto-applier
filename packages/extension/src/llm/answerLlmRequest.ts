// Answers one LLM request: loads the saved settings, builds a client and returns the answer or the reason it failed.
import { PROVIDER_LABELS } from "@auto-applier/core"
import type { LLMClient, LLMSettings, ProviderId, ProviderSettings, SettingsStore } from "@auto-applier/core"
import type { LlmRequest, LlmResponse } from "../messaging"

export type ClientFactories = {
  all: (settings: ProviderSettings) => LLMClient
  one: (provider: ProviderId, settings: LLMSettings) => LLMClient
}

// Picks the client for a request: the named provider alone, or every saved provider with fallback; undefined means the named provider has no key.
function clientFor(request: LlmRequest, settings: ProviderSettings, factories: ClientFactories): LLMClient | undefined {
  if (!request.provider) return factories.all(settings)

  const entry = settings[request.provider]
  return entry ? factories.one(request.provider, entry) : undefined
}

// Runs the prompt through a client built from the saved settings; every failure becomes a failed reply.
export async function answerLlmRequest(
  request: LlmRequest,
  store: SettingsStore,
  factories: ClientFactories,
): Promise<LlmResponse> {
  try {
    const client = clientFor(request, await store.load(), factories)
    if (!client && request.provider) {
      return { ok: false, error: `No ${PROVIDER_LABELS[request.provider]} API key is saved. Save one in the extension's LLM settings.` }
    }

    const data = await client?.completeJson(request.prompt)
    return { ok: true, data }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "The LLM request failed" }
  }
}

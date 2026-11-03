// Builds the LLM client for one provider, or a fallback chain over every provider that has a key.
import type { LLMClient } from "../ports/LLMClient"
import { FallbackLLMClient } from "./FallbackLLMClient"
import { GeminiLLMClient } from "./GeminiLLMClient"
import { GroqLLMClient } from "./GroqLLMClient"
import { configuredProviders } from "./providerSettings"
import type { ProviderSettings } from "./providerSettings"
import type { LLMSettings, ProviderId } from "./settings"

export type ClientOptions = {
  fetchFn?: typeof fetch
  timeoutMs?: number
}

const CLIENT_FACTORIES: Record<ProviderId, (settings: LLMSettings, options: ClientOptions) => LLMClient> = {
  gemini: (settings, options) => new GeminiLLMClient(settings, options),
  groq: (settings, options) => new GroqLLMClient(settings, options),
}

// Creates the client for a single provider.
export function createProviderClient(provider: ProviderId, settings: LLMSettings, options: ClientOptions = {}): LLMClient {
  return CLIENT_FACTORIES[provider](settings, options)
}

// Creates a client that tries every provider with a saved key in order, so a backup answers when the main one fails.
export function createFallbackClient(settings: ProviderSettings, options: ClientOptions = {}): LLMClient {
  const clients = configuredProviders(settings).flatMap((provider) => {
    const entry = settings[provider]
    return entry ? [createProviderClient(provider, entry, options)] : []
  })
  return new FallbackLLMClient(clients)
}

// Builds the LLM client for one provider, or a fallback chain over every provider that has a key.
import type { LLMClient } from "../ports/LLMClient"
import { FallbackLLMClient } from "./FallbackLLMClient"
import { GeminiLLMClient } from "./GeminiLLMClient"
import { GroqLLMClient } from "./GroqLLMClient"
import { RetryingLLMClient } from "./RetryingLLMClient"
import { configuredProviders } from "./providerSettings"
import type { ProviderSettings } from "./providerSettings"
import type { LLMSettings, ProviderId } from "./settings"

export type ClientOptions = {
  fetchFn?: typeof fetch
  timeoutMs?: number
  retryDelaysMs?: readonly number[]
}

type HttpOptions = Pick<ClientOptions, "fetchFn" | "timeoutMs">

const CLIENT_FACTORIES: Record<ProviderId, (settings: LLMSettings, options: HttpOptions) => LLMClient> = {
  gemini: (settings, options) => new GeminiLLMClient(settings, options),
  groq: (settings, options) => new GroqLLMClient(settings, options),
}

// Creates the client for a single provider, which retries temporary failures (busy server, rate limit, dropped connection).
export function createProviderClient(provider: ProviderId, settings: LLMSettings, options: ClientOptions = {}): LLMClient {
  const { retryDelaysMs, ...http } = options
  return new RetryingLLMClient(CLIENT_FACTORIES[provider](settings, http), { delaysMs: retryDelaysMs })
}

// Creates a client that tries every provider with a saved key in order, so a backup answers when the main one fails.
export function createFallbackClient(settings: ProviderSettings, options: ClientOptions = {}): LLMClient {
  const clients = configuredProviders(settings).flatMap((provider) => {
    const entry = settings[provider]
    return entry ? [createProviderClient(provider, entry, options)] : []
  })
  return new FallbackLLMClient(clients)
}

// Holds the settings of every LLM provider, reads them back from storage (including the old Gemini-only shape) and updates them.
import { isLLMSettings } from "./settings"
import type { LLMSettings, ProviderId } from "./settings"

export type ProviderSettings = Partial<Record<ProviderId, LLMSettings>>

// The order providers are tried in: the first is the main one, the rest are backups.
export const PROVIDER_ORDER: readonly ProviderId[] = ["gemini", "groq"]

// Turns whatever was stored into provider settings: the old single-provider shape is Gemini's, unusable entries are dropped.
export function parseStoredSettings(value: unknown): ProviderSettings {
  if (isLLMSettings(value)) return { gemini: value }
  if (typeof value !== "object" || value === null) return {}

  const stored = value as Record<string, unknown>
  return Object.fromEntries(PROVIDER_ORDER.flatMap((id) => (isLLMSettings(stored[id]) ? [[id, stored[id]]] : [])))
}

// Returns a copy of the settings with one provider's entry added or replaced.
export function withProvider(settings: ProviderSettings, provider: ProviderId, entry: LLMSettings): ProviderSettings {
  return { ...settings, [provider]: entry }
}

// Lists the providers that have settings, in the order they are tried.
export function configuredProviders(settings: ProviderSettings): ProviderId[] {
  return PROVIDER_ORDER.filter((id) => settings[id] !== undefined)
}

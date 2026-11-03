// Defines how the app loads and saves the user's LLM settings for every provider, without knowing where they are stored.
import type { ProviderSettings } from "../llm/providerSettings"

export interface SettingsStore {
  load(): Promise<ProviderSettings>
  save(settings: ProviderSettings): Promise<void>
}

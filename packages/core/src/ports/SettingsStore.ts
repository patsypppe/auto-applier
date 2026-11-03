// Defines how the app loads and saves the user's LLM settings, without knowing where they are stored.
import type { LLMSettings } from "../llm/settings"

export interface SettingsStore {
  load(): Promise<LLMSettings | undefined>
  save(settings: LLMSettings): Promise<void>
}

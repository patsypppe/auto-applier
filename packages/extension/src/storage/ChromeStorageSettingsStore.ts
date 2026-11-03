// Stores the LLM settings in chrome.storage.local, implementing the core's SettingsStore.
import { isLLMSettings } from "@auto-applier/core"
import type { LLMSettings, SettingsStore } from "@auto-applier/core"

const SETTINGS_KEY = "llm-settings"

export class ChromeStorageSettingsStore implements SettingsStore {
  // Reads the saved settings, ignoring anything stored that is not valid settings.
  async load(): Promise<LLMSettings | undefined> {
    const stored = await chrome.storage.local.get(SETTINGS_KEY)
    const value: unknown = stored[SETTINGS_KEY]
    return isLLMSettings(value) ? value : undefined
  }

  // Writes the settings to chrome.storage.local, replacing any previous ones.
  async save(settings: LLMSettings): Promise<void> {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
  }
}

// Stores the LLM settings of every provider in chrome.storage.local, implementing the core's SettingsStore.
import { parseStoredSettings } from "@auto-applier/core"
import type { ProviderSettings, SettingsStore } from "@auto-applier/core"

const SETTINGS_KEY = "llm-settings"

export class ChromeStorageSettingsStore implements SettingsStore {
  // Reads the saved settings, ignoring anything stored that is not valid and understanding the old Gemini-only shape.
  async load(): Promise<ProviderSettings> {
    const stored = await chrome.storage.local.get(SETTINGS_KEY)
    return parseStoredSettings(stored[SETTINGS_KEY])
  }

  // Writes the settings to chrome.storage.local, replacing any previous ones.
  async save(settings: ProviderSettings): Promise<void> {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
  }
}

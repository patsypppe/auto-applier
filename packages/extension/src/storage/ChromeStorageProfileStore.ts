// Stores the profile in chrome.storage.local, implementing the core's ProfileStore.
import type { Profile, ProfileStore } from "@auto-applier/core"

const PROFILE_KEY = "profile"

export class ChromeStorageProfileStore implements ProfileStore {
  // Reads the saved profile from chrome.storage.local, if there is one.
  async load(): Promise<Profile | undefined> {
    const stored = await chrome.storage.local.get(PROFILE_KEY)
    return stored[PROFILE_KEY] as Profile | undefined
  }

  // Writes the profile to chrome.storage.local, replacing any previous one.
  async save(profile: Profile): Promise<void> {
    await chrome.storage.local.set({ [PROFILE_KEY]: profile })
  }
}

// Popup script: shows the current profile status when the extension icon is clicked.
import { fullName } from "@auto-applier/core"
import { ChromeStorageProfileStore } from "../storage/ChromeStorageProfileStore"

// Shows whether a profile is saved, and whose it is.
async function showStatus(): Promise<void> {
  const status = document.getElementById("status")
  if (!status) return

  const profile = await new ChromeStorageProfileStore().load()
  status.textContent = profile
    ? `Profile saved for ${fullName(profile.personal)}`
    : "No profile yet."
}

void showStatus()

// Tests that the profile is read from and written to chrome.storage.local under the profile key.
import type { Profile } from "@auto-applier/core"
import { afterEach, describe, expect, test, vi } from "vitest"
import { ChromeStorageProfileStore } from "./ChromeStorageProfileStore"

const PROFILE: Profile = {
  personal: { firstName: "Pranav", lastName: "P", email: "p@example.com", phone: "555", links: {} },
  experience: [],
  education: [],
  skills: [],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
}

// Replaces the chrome global with a storage that holds the given items.
function stubStorage(items: Record<string, unknown>) {
  const get = vi.fn(async (key: string) => ({ [key]: items[key] }))
  const set = vi.fn(async () => undefined)
  vi.stubGlobal("chrome", { storage: { local: { get, set } } })
  return { get, set }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ChromeStorageProfileStore", () => {
  test("returns undefined when no profile is saved", async () => {
    stubStorage({})

    expect(await new ChromeStorageProfileStore().load()).toBeUndefined()
  })

  test("returns the saved profile", async () => {
    stubStorage({ profile: PROFILE })

    expect(await new ChromeStorageProfileStore().load()).toEqual(PROFILE)
  })

  test("saves the profile under the profile key", async () => {
    const { set } = stubStorage({})

    await new ChromeStorageProfileStore().save(PROFILE)

    expect(set).toHaveBeenCalledWith({ profile: PROFILE })
  })
})

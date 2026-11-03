// Tests that settings are read back only when valid, and written under their own storage key.
import { afterEach, describe, expect, test, vi } from "vitest"
import { ChromeStorageSettingsStore } from "./ChromeStorageSettingsStore"

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

describe("ChromeStorageSettingsStore", () => {
  test("returns undefined when nothing is saved", async () => {
    stubStorage({})

    expect(await new ChromeStorageSettingsStore().load()).toBeUndefined()
  })

  test("returns saved settings", async () => {
    stubStorage({ "llm-settings": { apiKey: "key-123", model: "model-x" } })

    expect(await new ChromeStorageSettingsStore().load()).toEqual({ apiKey: "key-123", model: "model-x" })
  })

  test("ignores stored data that is not valid settings", async () => {
    stubStorage({ "llm-settings": { apiKey: "", model: 5 } })

    expect(await new ChromeStorageSettingsStore().load()).toBeUndefined()
  })

  test("saves settings under the llm-settings key", async () => {
    const { set } = stubStorage({})

    await new ChromeStorageSettingsStore().save({ apiKey: "key-123", model: "model-x" })

    expect(set).toHaveBeenCalledWith({ "llm-settings": { apiKey: "key-123", model: "model-x" } })
  })
})

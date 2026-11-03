// Tests that settings are read back only when valid (including the old Gemini-only shape), and written under their own storage key.
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
  test("returns nothing configured when nothing is saved", async () => {
    stubStorage({})

    expect(await new ChromeStorageSettingsStore().load()).toEqual({})
  })

  test("reads the old single-provider shape as Gemini's settings", async () => {
    stubStorage({ "llm-settings": { apiKey: "key-123", model: "model-x" } })

    expect(await new ChromeStorageSettingsStore().load()).toEqual({ gemini: { apiKey: "key-123", model: "model-x" } })
  })

  test("reads settings saved per provider", async () => {
    const gemini = { apiKey: "gemini-key", model: "gemini-model" }
    const groq = { apiKey: "groq-key", model: "groq-model" }
    stubStorage({ "llm-settings": { gemini, groq } })

    expect(await new ChromeStorageSettingsStore().load()).toEqual({ gemini, groq })
  })

  test("ignores stored data that is not valid settings", async () => {
    stubStorage({ "llm-settings": { apiKey: "", model: 5 } })

    expect(await new ChromeStorageSettingsStore().load()).toEqual({})
  })

  test("saves the per-provider settings under the llm-settings key", async () => {
    const { set } = stubStorage({})
    const groq = { apiKey: "groq-key", model: "groq-model" }

    await new ChromeStorageSettingsStore().save({ groq })

    expect(set).toHaveBeenCalledWith({ "llm-settings": { groq } })
  })
})

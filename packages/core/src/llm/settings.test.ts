// Tests that stored LLM settings are recognised only when they hold a usable key and model.
import { describe, expect, test } from "vitest"
import { DEFAULT_MODEL, isLLMSettings, mergeSettings } from "./settings"

describe("mergeSettings", () => {
  const saved = { apiKey: "saved-key", model: "saved-model" }

  test("uses the typed key and model", () => {
    expect(mergeSettings(undefined, "typed-key", "typed-model")).toEqual({ apiKey: "typed-key", model: "typed-model" })
  })

  test("trims whitespace around what was typed", () => {
    expect(mergeSettings(undefined, "  typed-key  ", "  typed-model ")).toEqual({
      apiKey: "typed-key",
      model: "typed-model",
    })
  })

  test("keeps the saved key when the key box is left blank", () => {
    expect(mergeSettings(saved, "", "typed-model")).toEqual({ apiKey: "saved-key", model: "typed-model" })
    expect(mergeSettings(saved, "   ", "typed-model")?.apiKey).toBe("saved-key")
  })

  test("replaces the saved key when a new one is typed", () => {
    expect(mergeSettings(saved, "new-key", "saved-model")?.apiKey).toBe("new-key")
  })

  test("falls back to the default model when the model box is blank", () => {
    expect(mergeSettings(undefined, "typed-key", "  ")?.model).toBe(DEFAULT_MODEL)
  })

  test("returns undefined when there is no key anywhere", () => {
    expect(mergeSettings(undefined, "", "typed-model")).toBeUndefined()
    expect(mergeSettings(undefined, "   ", "")).toBeUndefined()
  })
})

describe("DEFAULT_MODEL", () => {
  test("is a non-empty model name", () => {
    expect(DEFAULT_MODEL.length).toBeGreaterThan(0)
  })
})

describe("isLLMSettings", () => {
  test("accepts an object with a key and a model", () => {
    expect(isLLMSettings({ apiKey: "abc123", model: DEFAULT_MODEL })).toBe(true)
  })

  test("rejects a missing or empty key", () => {
    expect(isLLMSettings({ model: DEFAULT_MODEL })).toBe(false)
    expect(isLLMSettings({ apiKey: "", model: DEFAULT_MODEL })).toBe(false)
  })

  test("rejects a missing or empty model", () => {
    expect(isLLMSettings({ apiKey: "abc123" })).toBe(false)
    expect(isLLMSettings({ apiKey: "abc123", model: "" })).toBe(false)
  })

  test("rejects values that are not strings", () => {
    expect(isLLMSettings({ apiKey: 123, model: DEFAULT_MODEL })).toBe(false)
    expect(isLLMSettings({ apiKey: "abc123", model: null })).toBe(false)
  })

  test("rejects values that are not objects", () => {
    expect(isLLMSettings(null)).toBe(false)
    expect(isLLMSettings(undefined)).toBe(false)
    expect(isLLMSettings("abc123")).toBe(false)
  })
})

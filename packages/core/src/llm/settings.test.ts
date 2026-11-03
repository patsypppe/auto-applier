// Tests that stored LLM settings are recognised only when they hold a usable key and model.
import { describe, expect, test } from "vitest"
import { DEFAULT_MODEL, isLLMSettings } from "./settings"

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

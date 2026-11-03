// Tests reading saved provider settings (including the old single-provider shape) and updating them without mutation.
import { describe, expect, test } from "vitest"
import { configuredProviders, parseStoredSettings, withProvider } from "./providerSettings"

const gemini = { apiKey: "gemini-key", model: "gemini-model" }
const groq = { apiKey: "groq-key", model: "groq-model" }

describe("parseStoredSettings", () => {
  test("returns nothing configured for missing or unusable values", () => {
    expect(parseStoredSettings(undefined)).toEqual({})
    expect(parseStoredSettings(null)).toEqual({})
    expect(parseStoredSettings("text")).toEqual({})
    expect(parseStoredSettings(42)).toEqual({})
    expect(parseStoredSettings({})).toEqual({})
  })

  test("reads the old single-provider shape as the Gemini settings", () => {
    expect(parseStoredSettings(gemini)).toEqual({ gemini })
  })

  test("ignores an old-shape value that is not usable", () => {
    expect(parseStoredSettings({ apiKey: "", model: "x" })).toEqual({})
  })

  test("reads the per-provider shape", () => {
    expect(parseStoredSettings({ gemini, groq })).toEqual({ gemini, groq })
    expect(parseStoredSettings({ groq })).toEqual({ groq })
  })

  test("drops a provider whose settings are not usable and keeps the other", () => {
    expect(parseStoredSettings({ gemini: { apiKey: "", model: "m" }, groq })).toEqual({ groq })
  })

  test("drops unknown providers and extra fields", () => {
    expect(parseStoredSettings({ gemini, openai: { apiKey: "k", model: "m" }, extra: 1 })).toEqual({ gemini })
  })
})

describe("withProvider", () => {
  test("adds a provider without changing the original", () => {
    const original = { gemini }

    const updated = withProvider(original, "groq", groq)

    expect(updated).toEqual({ gemini, groq })
    expect(original).toEqual({ gemini })
  })

  test("replaces a provider's settings", () => {
    const replacement = { apiKey: "new-key", model: "new-model" }

    expect(withProvider({ gemini }, "gemini", replacement)).toEqual({ gemini: replacement })
  })
})

describe("configuredProviders", () => {
  test("lists the providers that have settings in fallback order, whatever order they were saved in", () => {
    expect(configuredProviders({ groq, gemini })).toEqual(["gemini", "groq"])
  })

  test("lists only the ones that are set", () => {
    expect(configuredProviders({ groq })).toEqual(["groq"])
    expect(configuredProviders({})).toEqual([])
  })
})

// Tests that LLM requests are answered from the saved settings, and that every failure becomes a reply.
import { createFallbackClient } from "@auto-applier/core"
import type { LLMClient, LLMSettings, ProviderSettings, SettingsStore } from "@auto-applier/core"
import { describe, expect, test, vi } from "vitest"
import { answerLlmRequest } from "./answerLlmRequest"

const GEMINI: LLMSettings = { apiKey: "gemini-key", model: "gemini-model" }
const GROQ: LLMSettings = { apiKey: "groq-key", model: "groq-model" }

// Builds a settings store that holds the given settings.
function storeWith(settings: ProviderSettings): SettingsStore {
  return { load: async () => settings, save: vi.fn(async () => undefined) }
}

// Builds client factories whose clients answer with the given function.
function factoriesFor(answer: (prompt: string) => Promise<unknown>) {
  const client: LLMClient = { completeJson: vi.fn(answer) }
  return { client, all: vi.fn(() => client), one: vi.fn(() => client) }
}

describe("answerLlmRequest: any provider", () => {
  test("asks the combined client for the prompt and returns its answer", async () => {
    const { client, all, one } = factoriesFor(async () => ({ firstName: "Pranav" }))

    const response = await answerLlmRequest(
      { type: "llm-complete", prompt: "Parse this" },
      storeWith({ gemini: GEMINI }),
      { all, one },
    )

    expect(response).toEqual({ ok: true, data: { firstName: "Pranav" } })
    expect(client.completeJson).toHaveBeenCalledWith("Parse this")
    expect(one).not.toHaveBeenCalled()
  })

  test("builds the combined client from every saved provider", async () => {
    const { all, one } = factoriesFor(async () => ({}))
    const saved = { gemini: GEMINI, groq: GROQ }

    await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith(saved), { all, one })

    expect(all).toHaveBeenCalledWith(saved)
  })

  test("says no LLM is set up when nothing is saved", async () => {
    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith({}), {
      all: createFallbackClient,
      one: vi.fn(),
    })

    expect(response).toEqual({ ok: false, error: expect.stringContaining("No LLM is set up") })
  })
})

describe("answerLlmRequest: one named provider", () => {
  test("uses only that provider's client and settings", async () => {
    const { client, all, one } = factoriesFor(async () => ({ ok: true }))

    const response = await answerLlmRequest(
      { type: "llm-complete", prompt: "hi", provider: "groq" },
      storeWith({ gemini: GEMINI, groq: GROQ }),
      { all, one },
    )

    expect(response).toEqual({ ok: true, data: { ok: true } })
    expect(one).toHaveBeenCalledWith("groq", GROQ)
    expect(all).not.toHaveBeenCalled()
    expect(client.completeJson).toHaveBeenCalledWith("hi")
  })

  test("says that provider has no key even when another provider does", async () => {
    const { client, all, one } = factoriesFor(async () => ({}))

    const response = await answerLlmRequest(
      { type: "llm-complete", prompt: "hi", provider: "groq" },
      storeWith({ gemini: GEMINI }),
      { all, one },
    )

    expect(response).toEqual({ ok: false, error: expect.stringContaining("No Groq API key") })
    expect(one).not.toHaveBeenCalled()
    expect(client.completeJson).not.toHaveBeenCalled()
  })
})

describe("answerLlmRequest: failures", () => {
  test("turns a client error into a failed reply with its message", async () => {
    const { all, one } = factoriesFor(async () => {
      throw new Error("Gemini returned 400: API key not valid.")
    })

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith({ gemini: GEMINI }), {
      all,
      one,
    })

    expect(response).toEqual({ ok: false, error: "Gemini returned 400: API key not valid." })
  })

  test("turns a thrown non-Error into a generic failed reply", async () => {
    const { all, one } = factoriesFor(async () => {
      throw "weird"
    })

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith({ gemini: GEMINI }), {
      all,
      one,
    })

    expect(response).toEqual({ ok: false, error: "The LLM request failed" })
  })

  test("turns a failure to read the settings into a failed reply", async () => {
    const store: SettingsStore = {
      load: async () => {
        throw new Error("storage unavailable")
      },
      save: async () => undefined,
    }
    const { all, one } = factoriesFor(async () => ({}))

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, store, { all, one })

    expect(response).toEqual({ ok: false, error: "storage unavailable" })
  })
})

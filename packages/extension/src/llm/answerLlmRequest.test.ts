// Tests that LLM requests are answered from the saved settings, and that every failure becomes a reply.
import type { LLMClient, LLMSettings, SettingsStore } from "@auto-applier/core"
import { describe, expect, test, vi } from "vitest"
import { answerLlmRequest } from "./answerLlmRequest"

const SETTINGS: LLMSettings = { apiKey: "key-123", model: "model-x" }

// Builds a settings store that holds the given settings, or nothing.
function storeWith(settings: LLMSettings | undefined): SettingsStore {
  return { load: async () => settings, save: vi.fn(async () => undefined) }
}

// Builds a client factory whose client answers with the given function.
function factoryFor(answer: (prompt: string) => Promise<unknown>) {
  const client: LLMClient = { completeJson: vi.fn(answer) }
  return { client, create: vi.fn(() => client) }
}

describe("answerLlmRequest", () => {
  test("asks the client for the prompt and returns its answer", async () => {
    const { client, create } = factoryFor(async () => ({ firstName: "Pranav" }))

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "Parse this" }, storeWith(SETTINGS), create)

    expect(response).toEqual({ ok: true, data: { firstName: "Pranav" } })
    expect(client.completeJson).toHaveBeenCalledWith("Parse this")
  })

  test("builds the client from the saved settings", async () => {
    const { create } = factoryFor(async () => ({}))

    await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith(SETTINGS), create)

    expect(create).toHaveBeenCalledWith(SETTINGS)
  })

  test("says there is no key when nothing is saved, without calling the client", async () => {
    const { client, create } = factoryFor(async () => ({}))

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith(undefined), create)

    expect(response).toEqual({ ok: false, error: expect.stringContaining("No Gemini API key") })
    expect(create).not.toHaveBeenCalled()
    expect(client.completeJson).not.toHaveBeenCalled()
  })

  test("turns a client error into a failed reply with its message", async () => {
    const { create } = factoryFor(async () => {
      throw new Error("Gemini returned 400: API key not valid.")
    })

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith(SETTINGS), create)

    expect(response).toEqual({ ok: false, error: "Gemini returned 400: API key not valid." })
  })

  test("turns a thrown non-Error into a generic failed reply", async () => {
    const { create } = factoryFor(async () => {
      throw "weird"
    })

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, storeWith(SETTINGS), create)

    expect(response).toEqual({ ok: false, error: "The LLM request failed" })
  })

  test("turns a failure to read the settings into a failed reply", async () => {
    const store: SettingsStore = {
      load: async () => {
        throw new Error("storage unavailable")
      },
      save: async () => undefined,
    }
    const { create } = factoryFor(async () => ({}))

    const response = await answerLlmRequest({ type: "llm-complete", prompt: "hi" }, store, create)

    expect(response).toEqual({ ok: false, error: "storage unavailable" })
  })
})

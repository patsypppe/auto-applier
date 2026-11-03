// Tests that FallbackLLMClient tries its clients in order and reports every failure when none works.
import { describe, expect, test, vi } from "vitest"
import type { LLMClient } from "../ports/LLMClient"
import { FallbackLLMClient } from "./FallbackLLMClient"

// Builds a client that answers with the given value.
function answering(value: unknown): LLMClient & { completeJson: ReturnType<typeof vi.fn> } {
  return { completeJson: vi.fn(async () => value) }
}

// Builds a client that fails with the given message.
function failing(message: string): LLMClient & { completeJson: ReturnType<typeof vi.fn> } {
  return {
    completeJson: vi.fn(async () => {
      throw new Error(message)
    }),
  }
}

describe("FallbackLLMClient", () => {
  test("returns the first client's answer and does not call the others", async () => {
    const first = answering({ from: "first" })
    const second = answering({ from: "second" })

    const result = await new FallbackLLMClient([first, second]).completeJson("hello")

    expect(result).toEqual({ from: "first" })
    expect(second.completeJson).not.toHaveBeenCalled()
  })

  test("passes the same prompt to the next client when the first fails", async () => {
    const first = failing("Gemini returned 503: busy")
    const second = answering({ from: "second" })

    const result = await new FallbackLLMClient([first, second]).completeJson("the prompt")

    expect(result).toEqual({ from: "second" })
    expect(second.completeJson).toHaveBeenCalledWith("the prompt")
  })

  test("keeps going until one client works", async () => {
    const clients = [failing("one down"), failing("two down"), answering({ ok: true })]

    expect(await new FallbackLLMClient(clients).completeJson("hello")).toEqual({ ok: true })
  })

  test("lists every failure when all clients fail", async () => {
    const clients = [failing("Gemini returned 503: busy"), failing("Groq returned 429: slow down")]

    await expect(new FallbackLLMClient(clients).completeJson("hello")).rejects.toThrow(
      "Gemini returned 503: busy; Groq returned 429: slow down",
    )
  })

  test("rethrows a single client's error unchanged", async () => {
    const client = new FallbackLLMClient([failing("Gemini returned 503: busy")])

    await expect(client.completeJson("hello")).rejects.toThrow(/^Gemini returned 503: busy$/)
  })

  test("describes a non-Error failure instead of printing nothing", async () => {
    const odd: LLMClient = {
      completeJson: async () => {
        throw "boom"
      },
    }

    await expect(new FallbackLLMClient([odd]).completeJson("hello")).rejects.toThrow("unknown error")
  })

  test("fails clearly when there are no clients", async () => {
    await expect(new FallbackLLMClient([]).completeJson("hello")).rejects.toThrow(
      "No LLM is set up. Add an API key in the extension's LLM settings.",
    )
  })
})

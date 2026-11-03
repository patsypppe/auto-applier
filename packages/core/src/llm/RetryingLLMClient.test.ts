// Tests that RetryingLLMClient retries only temporary failures, waits between tries, and gives up after the last delay.
import { describe, expect, test, vi } from "vitest"
import type { LLMClient } from "../ports/LLMClient"
import { LLMRequestError } from "./LLMRequestError"
import { RetryingLLMClient } from "./RetryingLLMClient"

// Builds a client that fails with the given errors in turn, then answers.
function failingThenAnswering(errors: Error[], answer: unknown = { ok: true }) {
  const remaining = [...errors]
  return {
    completeJson: vi.fn(async () => {
      const next = remaining.shift()
      if (next) throw next
      return answer
    }),
  } satisfies LLMClient
}

const temporary = () => new LLMRequestError("Gemini returned 503: busy", true)
const permanent = () => new LLMRequestError("Gemini returned 400: bad key", false)

describe("RetryingLLMClient", () => {
  test("returns the answer without waiting when the first try works", async () => {
    const client = failingThenAnswering([])
    const sleep = vi.fn(async (_ms: number) => undefined)

    const result = await new RetryingLLMClient(client, { sleep }).completeJson("hi")

    expect(result).toEqual({ ok: true })
    expect(client.completeJson).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  test("retries a temporary failure after the first delay", async () => {
    const client = failingThenAnswering([temporary()])
    const sleep = vi.fn(async (_ms: number) => undefined)

    const result = await new RetryingLLMClient(client, { delaysMs: [10, 20], sleep }).completeJson("hi")

    expect(result).toEqual({ ok: true })
    expect(client.completeJson).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(10)
  })

  test("waits longer before each further try and stops once it works", async () => {
    const client = failingThenAnswering([temporary(), temporary()])
    const sleep = vi.fn(async (_ms: number) => undefined)

    await new RetryingLLMClient(client, { delaysMs: [10, 20], sleep }).completeJson("hi")

    expect(client.completeJson).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([10, 20])
  })

  test("gives up with the last error after the delays run out", async () => {
    const client = failingThenAnswering([temporary(), temporary(), temporary(), temporary()])
    const sleep = vi.fn(async (_ms: number) => undefined)

    await expect(new RetryingLLMClient(client, { delaysMs: [10, 20], sleep }).completeJson("hi")).rejects.toThrow(
      "Gemini returned 503: busy",
    )
    expect(client.completeJson).toHaveBeenCalledTimes(3)
  })

  test("does not retry a permanent failure", async () => {
    const client = failingThenAnswering([permanent()])
    const sleep = vi.fn(async (_ms: number) => undefined)

    await expect(new RetryingLLMClient(client, { sleep }).completeJson("hi")).rejects.toThrow("bad key")
    expect(client.completeJson).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  test("does not retry an error that is not an LLMRequestError", async () => {
    const client = failingThenAnswering([new Error("Gemini did not return valid JSON")])

    await expect(new RetryingLLMClient(client, { sleep: async () => undefined }).completeJson("hi")).rejects.toThrow(
      "valid JSON",
    )
    expect(client.completeJson).toHaveBeenCalledTimes(1)
  })

  test("never retries when there are no delays", async () => {
    const client = failingThenAnswering([temporary()])

    await expect(
      new RetryingLLMClient(client, { delaysMs: [], sleep: async () => undefined }).completeJson("hi"),
    ).rejects.toThrow("503")
    expect(client.completeJson).toHaveBeenCalledTimes(1)
  })

  test("sends the same prompt on every try", async () => {
    const client = failingThenAnswering([temporary()])

    await new RetryingLLMClient(client, { sleep: async () => undefined }).completeJson("the prompt")

    expect(client.completeJson).toHaveBeenNthCalledWith(1, "the prompt")
    expect(client.completeJson).toHaveBeenNthCalledWith(2, "the prompt")
  })
})

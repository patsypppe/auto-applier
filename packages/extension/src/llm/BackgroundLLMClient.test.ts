// Tests that BackgroundLLMClient relays prompts to the background worker and reports its replies faithfully.
import { afterEach, describe, expect, test, vi } from "vitest"
import { BackgroundLLMClient } from "./BackgroundLLMClient"

// Replaces the chrome global with a runtime whose sendMessage behaves as given.
function stubSendMessage(sendMessage: (message: unknown) => Promise<unknown>) {
  const spy = vi.fn(sendMessage)
  vi.stubGlobal("chrome", { runtime: { sendMessage: spy } })
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("BackgroundLLMClient", () => {
  test("sends the prompt to the background worker as an llm-complete request", async () => {
    const sendMessage = stubSendMessage(async () => ({ ok: true, data: {} }))

    await new BackgroundLLMClient().completeJson("Parse this resume")

    expect(sendMessage).toHaveBeenCalledWith({ type: "llm-complete", prompt: "Parse this resume" })
  })

  test("names the provider in the request when one is given", async () => {
    const sendMessage = stubSendMessage(async () => ({ ok: true, data: {} }))

    await new BackgroundLLMClient("groq").completeJson("hi")

    expect(sendMessage).toHaveBeenCalledWith({ type: "llm-complete", prompt: "hi", provider: "groq" })
  })

  test("sends no provider field when none is given", async () => {
    const sendMessage = stubSendMessage(async () => ({ ok: true, data: {} }))

    await new BackgroundLLMClient().completeJson("hi")

    expect(Object.keys(sendMessage.mock.calls[0]?.[0] as object)).toEqual(["type", "prompt"])
  })

  test("returns the data from a successful reply", async () => {
    stubSendMessage(async () => ({ ok: true, data: { firstName: "Pranav" } }))

    expect(await new BackgroundLLMClient().completeJson("hi")).toEqual({ firstName: "Pranav" })
  })

  test("throws the error text from a failed reply", async () => {
    stubSendMessage(async () => ({ ok: false, error: "Gemini returned 400: API key not valid." }))

    await expect(new BackgroundLLMClient().completeJson("hi")).rejects.toThrow("Gemini returned 400: API key not valid.")
  })

  test("throws when the reply is not in the expected shape", async () => {
    stubSendMessage(async () => ({ something: "else" }))

    await expect(new BackgroundLLMClient().completeJson("hi")).rejects.toThrow("unexpected reply")
  })

  test("throws when there is no reply at all", async () => {
    stubSendMessage(async () => undefined)

    await expect(new BackgroundLLMClient().completeJson("hi")).rejects.toThrow("unexpected reply")
  })

  test("explains a failure to reach the background worker", async () => {
    stubSendMessage(async () => {
      throw new Error("Receiving end does not exist.")
    })

    await expect(new BackgroundLLMClient().completeJson("hi")).rejects.toThrow(
      "Could not reach the extension's background worker: Receiving end does not exist.",
    )
  })
})

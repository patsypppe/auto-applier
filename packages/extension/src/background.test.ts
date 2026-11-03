// Tests the background worker end to end: it answers LLM requests from this extension and nobody else.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

type Listener = (message: unknown, sender: { id?: string }, sendResponse: (response: unknown) => void) => boolean

const EXTENSION_ID = "this-extension"
const GEMINI_ANSWER = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }] }

// Stubs chrome (with the given stored items) and fetch, loads the worker, and returns its message listener.
async function loadWorker(stored: Record<string, unknown>) {
  const addListener = vi.fn()
  const fetchStub = vi.fn(async () => new Response(JSON.stringify(GEMINI_ANSWER)))
  vi.stubGlobal("chrome", {
    runtime: { id: EXTENSION_ID, onMessage: { addListener } },
    storage: { local: { get: vi.fn(async (key: string) => ({ [key]: stored[key] })) } },
  })
  vi.stubGlobal("fetch", fetchStub)

  await import("./background")
  return { listener: addListener.mock.calls[0]?.[0] as Listener, fetchStub }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("background worker", () => {
  test("registers a message listener", async () => {
    const { listener } = await loadWorker({})

    expect(typeof listener).toBe("function")
  })

  test("answers an LLM request from this extension using the saved settings", async () => {
    const { listener, fetchStub } = await loadWorker({ "llm-settings": { apiKey: "key-123", model: "model-x" } })
    const sendResponse = vi.fn()

    const keepsChannelOpen = listener({ type: "llm-complete", prompt: "hi" }, { id: EXTENSION_ID }, sendResponse)

    expect(keepsChannelOpen).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { ok: true } }))
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain("/models/model-x:generateContent")
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key-123")
  })

  test("replies with a clear error when no key is saved", async () => {
    const { listener, fetchStub } = await loadWorker({})
    const sendResponse = vi.fn()

    listener({ type: "llm-complete", prompt: "hi" }, { id: EXTENSION_ID }, sendResponse)

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: expect.stringContaining("No Gemini API key") }),
    )
    expect(fetchStub).not.toHaveBeenCalled()
  })

  test("ignores messages sent by another extension", async () => {
    const { listener, fetchStub } = await loadWorker({ "llm-settings": { apiKey: "key-123", model: "model-x" } })
    const sendResponse = vi.fn()

    const keepsChannelOpen = listener({ type: "llm-complete", prompt: "hi" }, { id: "someone-else" }, sendResponse)

    expect(keepsChannelOpen).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
    expect(fetchStub).not.toHaveBeenCalled()
  })

  test("ignores messages that are not LLM requests", async () => {
    const { listener, fetchStub } = await loadWorker({ "llm-settings": { apiKey: "key-123", model: "model-x" } })
    const sendResponse = vi.fn()

    expect(listener({ type: "fill-page" }, { id: EXTENSION_ID }, sendResponse)).toBe(false)
    expect(listener("nonsense", { id: EXTENSION_ID }, sendResponse)).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

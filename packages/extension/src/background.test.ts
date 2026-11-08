// Tests the background worker end to end: it answers LLM requests from this extension and nobody else.
import "fake-indexeddb/auto"
import { emptySummary } from "@auto-applier/core"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createFakeSessionStorage } from "./testing/fakeSessionStorage"

type Sender = { id?: string; tab?: { id?: number }; frameId?: number }
type Listener = (message: unknown, sender: Sender, sendResponse: (response: unknown) => void) => boolean

const EXTENSION_ID = "this-extension"
const GEMINI_ANSWER = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }] }

// Stubs chrome (with the given stored items) and fetch, loads the worker, and returns its message listener.
async function loadWorker(
  stored: Record<string, unknown>,
  respond: (url: string) => Response = () => new Response(JSON.stringify(GEMINI_ANSWER)),
) {
  const addListener = vi.fn()
  const fetchStub = vi.fn(async (input: RequestInfo | URL) => respond(String(input)))
  const fake = createFakeSessionStorage()
  vi.stubGlobal("chrome", {
    runtime: { id: EXTENSION_ID, onMessage: { addListener } },
    storage: { ...fake.storage, local: { get: vi.fn(async (key: string) => ({ [key]: stored[key] })) } },
  })
  vi.stubGlobal("fetch", fetchStub)

  await import("./background")
  return { listener: addListener.mock.calls[0]?.[0] as Listener, fetchStub, saved: fake.items }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
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
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: expect.stringContaining("No LLM is set up") }),
    )
    expect(fetchStub).not.toHaveBeenCalled()
  })

  test("falls back to Groq when Gemini fails for good", async () => {
    const stored = {
      "llm-settings": {
        gemini: { apiKey: "gemini-key", model: "gemini-model" },
        groq: { apiKey: "groq-key", model: "groq-model" },
      },
    }
    const { listener, fetchStub } = await loadWorker(stored, (url) =>
      url.includes("generativelanguage")
        ? new Response(JSON.stringify({ error: { message: "API key not valid." } }), { status: 400 })
        : new Response(JSON.stringify({ choices: [{ message: { content: '{"from":"groq"}' }, finish_reason: "stop" }] })),
    )
    const sendResponse = vi.fn()

    listener({ type: "llm-complete", prompt: "hi" }, { id: EXTENSION_ID }, sendResponse)

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { from: "groq" } }))
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  test("retries Gemini after a temporary 503 before giving up on it", async () => {
    vi.useFakeTimers()
    let geminiCalls = 0
    const { listener, fetchStub } = await loadWorker(
      { "llm-settings": { gemini: { apiKey: "gemini-key", model: "gemini-model" } } },
      () => {
        geminiCalls += 1
        return geminiCalls === 1
          ? new Response(JSON.stringify({ error: { message: "busy" } }), { status: 503 })
          : new Response(JSON.stringify(GEMINI_ANSWER))
      },
    )
    const sendResponse = vi.fn()

    listener({ type: "llm-complete", prompt: "hi" }, { id: EXTENSION_ID }, sendResponse)
    await vi.advanceTimersByTimeAsync(5000)

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { ok: true } })
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  test("tests one named provider on its own, without falling back", async () => {
    const stored = {
      "llm-settings": {
        gemini: { apiKey: "gemini-key", model: "gemini-model" },
        groq: { apiKey: "groq-key", model: "groq-model" },
      },
    }
    const { listener, fetchStub } = await loadWorker(stored, () =>
      new Response(JSON.stringify({ error: { message: "Invalid API Key" } }), { status: 401 }),
    )
    const sendResponse = vi.fn()

    listener({ type: "llm-complete", prompt: "hi", provider: "groq" }, { id: EXTENSION_ID }, sendResponse)

    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: "Groq returned 401: Invalid API Key" }),
    )
    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(String(fetchStub.mock.calls[0]?.[0])).toContain("api.groq.com")
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

describe("background worker: keeping fill results", () => {
  const RESULT = { ok: true, summary: { ...emptySummary(), filled: 3 }, notes: ["a note"] }
  const MESSAGE = { type: "fill-result", result: RESULT }

  test("saves a fill result from a content script under its tab and frame, without replying", async () => {
    const { listener, saved } = await loadWorker({})
    const sendResponse = vi.fn()

    const keepsChannelOpen = listener(MESSAGE, { id: EXTENSION_ID, tab: { id: 7 }, frameId: 2 }, sendResponse)

    expect(keepsChannelOpen).toBe(false)
    await vi.waitFor(() => expect(saved.get("fill-result:7:2")).toEqual(RESULT))
    expect(sendResponse).not.toHaveBeenCalled()
  })

  test("treats a missing frame id as the top frame", async () => {
    const { listener, saved } = await loadWorker({})

    listener(MESSAGE, { id: EXTENSION_ID, tab: { id: 7 } }, vi.fn())

    await vi.waitFor(() => expect(saved.has("fill-result:7:0")).toBe(true))
  })

  test("ignores fill results from another extension or without a tab", async () => {
    const { listener, saved } = await loadWorker({})

    listener(MESSAGE, { id: "someone-else", tab: { id: 7 }, frameId: 0 }, vi.fn())
    listener(MESSAGE, { id: EXTENSION_ID }, vi.fn())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(saved.size).toBe(0)
  })

  test("forgets a tab's saved results when its top frame loads a new page", async () => {
    const { listener, saved } = await loadWorker({})
    listener(MESSAGE, { id: EXTENSION_ID, tab: { id: 7 }, frameId: 0 }, vi.fn())
    listener(MESSAGE, { id: EXTENSION_ID, tab: { id: 8 }, frameId: 0 }, vi.fn())
    await vi.waitFor(() => expect(saved.size).toBe(2))

    listener({ type: "page-loaded" }, { id: EXTENSION_ID, tab: { id: 7 }, frameId: 0 }, vi.fn())

    await vi.waitFor(() => expect(saved.has("fill-result:7:0")).toBe(false))
    expect(saved.has("fill-result:8:0")).toBe(true)
  })

  test("keeps the saved results when only a sub-frame loads", async () => {
    const { listener, saved } = await loadWorker({})
    listener(MESSAGE, { id: EXTENSION_ID, tab: { id: 7 }, frameId: 0 }, vi.fn())
    await vi.waitFor(() => expect(saved.size).toBe(1))

    listener({ type: "page-loaded" }, { id: EXTENSION_ID, tab: { id: 7 }, frameId: 3 }, vi.fn())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(saved.has("fill-result:7:0")).toBe(true)
  })
})

describe("background worker: handing out the saved resume", () => {
  test("replies with the saved resume's bytes as text", async () => {
    const { IndexedDbResumeStore } = await import("./storage/IndexedDbResumeStore")
    await new IndexedDbResumeStore().save("resume", {
      name: "resume.pdf",
      mimeType: "application/pdf",
      data: new TextEncoder().encode("%PDF").buffer as ArrayBuffer,
    })
    const { listener } = await loadWorker({})
    const sendResponse = vi.fn()

    const keepsChannelOpen = listener({ type: "get-resume" }, { id: EXTENSION_ID, tab: { id: 7 } }, sendResponse)

    expect(keepsChannelOpen).toBe(true)
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        resume: { name: "resume.pdf", mimeType: "application/pdf", data: "JVBERg==" },
      }),
    )
  })

  test("ignores a resume request from another extension", async () => {
    const { listener } = await loadWorker({})
    const sendResponse = vi.fn()

    expect(listener({ type: "get-resume" }, { id: "someone-else" }, sendResponse)).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
  })
})

describe("background worker: progress", () => {
  test("saves a frame's progress under its tab and frame, for the popup", async () => {
    const { listener, saved } = await loadWorker({})
    const progress = { total: 10, filled: 4, phase: "rules" }

    listener({ type: "fill-progress", progress }, { id: EXTENSION_ID, tab: { id: 7 }, frameId: 2 }, vi.fn())

    await vi.waitFor(() => expect(saved.get("fill-progress:7:2")).toEqual(progress))
  })

  test("ignores progress from anyone but this extension", async () => {
    const { listener, saved } = await loadWorker({})

    listener({ type: "fill-progress", progress: { total: 1, filled: 0, phase: "rules" } }, { id: "someone-else", tab: { id: 7 } }, vi.fn())

    expect([...saved.keys()].some((key) => key.startsWith("fill-progress:"))).toBe(false)
  })
})

describe("background worker: Next-button flow state", () => {
  const FROM_TAB = { id: EXTENSION_ID, tab: { id: 7 }, frameId: 0 }

  test("saves a flow state for the sending tab and frame, and hands it back", async () => {
    const { listener } = await loadWorker({})
    listener({ type: "flow-save", state: { step: 2, clickedAt: 1000 } }, FROM_TAB, vi.fn())
    const sendResponse = vi.fn()

    const keepsChannelOpen = listener({ type: "flow-get" }, FROM_TAB, sendResponse)

    expect(keepsChannelOpen).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ state: { step: 2, clickedAt: 1000 } }))
  })

  test("forgets the state when the flow ends", async () => {
    const { listener } = await loadWorker({})
    listener({ type: "flow-save", state: { step: 2, clickedAt: 1000 } }, FROM_TAB, vi.fn())
    listener({ type: "flow-clear" }, FROM_TAB, vi.fn())
    const sendResponse = vi.fn()

    listener({ type: "flow-get" }, FROM_TAB, sendResponse)

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({}))
  })

  test("ignores flow messages from other extensions", async () => {
    const { listener, saved } = await loadWorker({})

    listener({ type: "flow-save", state: { step: 2, clickedAt: 1000 } }, { id: "someone-else", tab: { id: 7 } }, vi.fn())

    expect([...saved.keys()].some((key) => key.startsWith("flow:"))).toBe(false)
  })

  test("does not keep a flow state for a sender that is not in a tab", async () => {
    const { listener, saved } = await loadWorker({})

    listener({ type: "flow-save", state: { step: 2, clickedAt: 1000 } }, { id: EXTENSION_ID }, vi.fn())

    expect([...saved.keys()].some((key) => key.startsWith("flow:"))).toBe(false)
  })
})

// Tests that the right provider clients are built from saved settings, and that Gemini failing falls back to Groq.
import { describe, expect, test, vi } from "vitest"
import { createFallbackClient, createProviderClient } from "./createLlmClient"

const gemini = { apiKey: "gemini-key", model: "gemini-model" }
const groq = { apiKey: "groq-key", model: "groq-model" }

// Builds a fetch stand-in that answers Gemini and Groq URLs with the given statuses.
function routedFetch(geminiStatus: number, groqStatus: number) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("generativelanguage.googleapis.com")) {
      const body =
        geminiStatus === 200
          ? { candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] }, finishReason: "STOP" }] }
          : { error: { message: "busy" } }
      return new Response(JSON.stringify(body), { status: geminiStatus })
    }
    const body =
      groqStatus === 200
        ? { choices: [{ message: { content: '{"from":"groq"}' }, finish_reason: "stop" }] }
        : { error: { message: "slow down" } }
    return new Response(JSON.stringify(body), { status: groqStatus })
  })
}

// Returns the URLs a fetch stand-in was called with, in order.
function calledUrls(fetchFn: ReturnType<typeof routedFetch>): string[] {
  return fetchFn.mock.calls.map(([input]) => String(input))
}

describe("createProviderClient", () => {
  test("builds a Gemini client for gemini", async () => {
    const fetchFn = routedFetch(200, 200)

    const result = await createProviderClient("gemini", gemini, { fetchFn }).completeJson("hi")

    expect(result).toEqual({ from: "gemini" })
    expect(calledUrls(fetchFn)).toHaveLength(1)
  })

  test("builds a Groq client for groq", async () => {
    const fetchFn = routedFetch(200, 200)

    const result = await createProviderClient("groq", groq, { fetchFn }).completeJson("hi")

    expect(result).toEqual({ from: "groq" })
    expect(calledUrls(fetchFn)[0]).toContain("api.groq.com")
  })
})

describe("createFallbackClient", () => {
  test("uses only Gemini when only Gemini has a key", async () => {
    const fetchFn = routedFetch(200, 200)

    await createFallbackClient({ gemini }, { fetchFn }).completeJson("hi")

    expect(calledUrls(fetchFn).every((url) => url.includes("generativelanguage"))).toBe(true)
  })

  test("uses only Groq when only Groq has a key", async () => {
    const fetchFn = routedFetch(200, 200)

    const result = await createFallbackClient({ groq }, { fetchFn }).completeJson("hi")

    expect(result).toEqual({ from: "groq" })
  })

  test("asks Gemini first and does not touch Groq when Gemini answers", async () => {
    const fetchFn = routedFetch(200, 200)

    const result = await createFallbackClient({ gemini, groq }, { fetchFn }).completeJson("hi")

    expect(result).toEqual({ from: "gemini" })
    expect(calledUrls(fetchFn)).toHaveLength(1)
  })

  test("falls back to Groq when Gemini is overloaded", async () => {
    const fetchFn = routedFetch(503, 200)

    const result = await createFallbackClient({ gemini, groq }, { fetchFn, retryDelaysMs: [] }).completeJson("hi")

    expect(result).toEqual({ from: "groq" })
    expect(calledUrls(fetchFn)).toHaveLength(2)
  })

  test("retries a busy Gemini before falling back to Groq", async () => {
    const fetchFn = routedFetch(503, 200)

    const result = await createFallbackClient({ gemini, groq }, { fetchFn, retryDelaysMs: [0, 0] }).completeJson("hi")

    expect(result).toEqual({ from: "groq" })
    expect(calledUrls(fetchFn).filter((url) => url.includes("generativelanguage"))).toHaveLength(3)
    expect(calledUrls(fetchFn).filter((url) => url.includes("api.groq.com"))).toHaveLength(1)
  })

  test("answers from Gemini when a retry works, without touching Groq", async () => {
    let geminiCalls = 0
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes("generativelanguage")) throw new Error("Groq should not be called")
      geminiCalls += 1
      return geminiCalls === 1
        ? new Response(JSON.stringify({ error: { message: "busy" } }), { status: 503 })
        : new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"from":"gemini"}' }] }, finishReason: "STOP" }] }),
          )
    })

    const result = await createFallbackClient({ gemini, groq }, { fetchFn, retryDelaysMs: [0] }).completeJson("hi")

    expect(result).toEqual({ from: "gemini" })
    expect(geminiCalls).toBe(2)
  })

  test("does not retry a permanent failure such as a missing model", async () => {
    const fetchFn = routedFetch(200, 404)

    await expect(createFallbackClient({ groq }, { fetchFn, retryDelaysMs: [0, 0] }).completeJson("hi")).rejects.toThrow(
      "Groq returned 404",
    )
    expect(calledUrls(fetchFn)).toHaveLength(1)
  })

  test("reports both reasons when both providers fail", async () => {
    const fetchFn = routedFetch(503, 429)

    await expect(createFallbackClient({ gemini, groq }, { fetchFn, retryDelaysMs: [] }).completeJson("hi")).rejects.toThrow(
      /Gemini returned 503.*; Groq returned 429/,
    )
  })

  test("fails clearly when no provider has a key", async () => {
    await expect(createFallbackClient({}).completeJson("hi")).rejects.toThrow("No LLM is set up")
  })
})

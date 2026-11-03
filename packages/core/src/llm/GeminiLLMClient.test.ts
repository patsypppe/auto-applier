// Tests that GeminiLLMClient sends the right request, parses the answer, and fails with clear messages.
import { describe, expect, test, vi } from "vitest"
import { GeminiLLMClient } from "./GeminiLLMClient"

const API_KEY = "test-key-123"
const MODEL = "gemini-test-model"
const URL_FOR_MODEL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

// Wraps text in the shape Gemini uses for a successful answer.
function answerBody(text: string, finishReason = "STOP") {
  return { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }] }
}

// Builds a fetch stand-in that always returns the given status and JSON body.
function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

// Creates a client with the test key, model and the given fetch stand-in.
function clientWith(fetchFn: typeof fetch, timeoutMs?: number): GeminiLLMClient {
  return new GeminiLLMClient({ apiKey: API_KEY, model: MODEL }, { fetchFn, timeoutMs })
}

describe("GeminiLLMClient: the request", () => {
  test("posts to the model's generateContent URL", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))

    await clientWith(fetchFn).completeJson("hello")

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(URL_FOR_MODEL)
    expect(init.method).toBe("POST")
  })

  test("sends the key in a header and never in the URL", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))

    await clientWith(fetchFn).completeJson("hello")

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).not.toContain(API_KEY)
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(API_KEY)
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
  })

  test("sends the prompt and asks for a JSON answer", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))

    await clientWith(fetchFn).completeJson("Parse this resume")

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      contents: [{ role: "user", parts: [{ text: "Parse this resume" }] }],
      generationConfig: { responseMimeType: "application/json" },
    })
  })

  test("encodes odd characters in the model name", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))
    const client = new GeminiLLMClient({ apiKey: API_KEY, model: "my model/1" }, { fetchFn })

    await client.completeJson("hello")

    const [url] = fetchFn.mock.calls[0] as unknown as [string]
    expect(url).toContain("/models/my%20model%2F1:generateContent")
  })

  test("refuses to call the API without a key", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))
    const client = new GeminiLLMClient({ apiKey: "   ", model: MODEL }, { fetchFn })

    await expect(client.completeJson("hello")).rejects.toThrow("No Gemini API key is set")
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe("GeminiLLMClient: the answer", () => {
  test("returns the answer parsed as JSON", async () => {
    const client = clientWith(fakeFetch(answerBody('{"firstName":"Pranav","skills":["TypeScript"]}')))

    expect(await client.completeJson("hello")).toEqual({ firstName: "Pranav", skills: ["TypeScript"] })
  })

  test("joins an answer that arrives in several parts", async () => {
    const body = { candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] }, finishReason: "STOP" }] }

    expect(await clientWith(fakeFetch(body)).completeJson("hello")).toEqual({ a: 1 })
  })

  test("fails when the answer is not valid JSON", async () => {
    const client = clientWith(fakeFetch(answerBody("Sure! Here is your JSON")))

    await expect(client.completeJson("hello")).rejects.toThrow("Gemini did not return valid JSON")
  })

  test("fails when the answer is empty", async () => {
    const client = clientWith(fakeFetch(answerBody("")))

    await expect(client.completeJson("hello")).rejects.toThrow("Gemini returned an empty answer")
  })

  test("fails when the model stopped before finishing", async () => {
    const client = clientWith(fakeFetch(answerBody('{"a":', "MAX_TOKENS")))

    await expect(client.completeJson("hello")).rejects.toThrow("Gemini stopped early (MAX_TOKENS)")
  })

  test("says so when the prompt was blocked", async () => {
    const client = clientWith(fakeFetch({ promptFeedback: { blockReason: "SAFETY" } }))

    await expect(client.completeJson("hello")).rejects.toThrow("Gemini blocked the prompt (SAFETY)")
  })

  test("says so when there is no answer at all", async () => {
    const client = clientWith(fakeFetch({}))

    await expect(client.completeJson("hello")).rejects.toThrow("Gemini returned no answer")
  })
})

describe("GeminiLLMClient: errors from the API", () => {
  test("reports the status and Google's message", async () => {
    const client = clientWith(fakeFetch({ error: { code: 400, message: "API key not valid." } }, 400))

    await expect(client.completeJson("hello")).rejects.toThrow("Gemini returned 400: API key not valid.")
  })

  test("falls back to the status text when the error body is not JSON", async () => {
    const fetchFn = vi.fn(async () => new Response("<html>oops</html>", { status: 502, statusText: "Bad Gateway" }))

    await expect(clientWith(fetchFn).completeJson("hello")).rejects.toThrow("Gemini returned 502: Bad Gateway")
  })

  test("mentions the rate limit on a 429", async () => {
    const client = clientWith(fakeFetch({ error: { message: "Resource exhausted" } }, 429))

    await expect(client.completeJson("hello")).rejects.toThrow(/rate limit/i)
  })

  test("never puts the key in an error message", async () => {
    const client = clientWith(fakeFetch({ error: { message: "bad request" } }, 400))

    const error = await client.completeJson("hello").catch((caught: Error) => caught)

    expect((error as Error).message).not.toContain(API_KEY)
  })
})

describe("GeminiLLMClient: network trouble", () => {
  test("reports a failed connection", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })

    const error = await clientWith(fetchFn).completeJson("hello").catch((caught: Error) => caught)

    expect((error as Error).message).toBe("Could not reach Gemini: Failed to fetch")
    expect((error as Error).message).not.toContain(API_KEY)
  })

  test("gives up when Gemini takes too long", async () => {
    const hanging = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }),
    )

    await expect(clientWith(hanging as unknown as typeof fetch, 30).completeJson("hello")).rejects.toThrow(
      "Gemini did not answer in time",
    )
  })
})

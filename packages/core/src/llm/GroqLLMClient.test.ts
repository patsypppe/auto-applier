// Tests that GroqLLMClient sends the right request, parses the answer, and fails with clear messages.
import { describe, expect, test, vi } from "vitest"
import { GroqLLMClient } from "./GroqLLMClient"
import { LLMRequestError } from "./LLMRequestError"

const API_KEY = "gsk-test-key-123"
const MODEL = "groq-test-model"
const URL_FOR_CHAT = "https://api.groq.com/openai/v1/chat/completions"

// Wraps text in the shape Groq uses for a successful answer.
function answerBody(content: string | null, finishReason = "stop") {
  return { choices: [{ message: { role: "assistant", content }, finish_reason: finishReason }] }
}

// Builds a fetch stand-in that always returns the given status and JSON body.
function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

// Creates a client with the test key, model and the given fetch stand-in.
function clientWith(fetchFn: typeof fetch, timeoutMs?: number): GroqLLMClient {
  return new GroqLLMClient({ apiKey: API_KEY, model: MODEL }, { fetchFn, timeoutMs })
}

describe("GroqLLMClient: the request", () => {
  test("posts to the chat completions URL", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))

    await clientWith(fetchFn).completeJson("hello")

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(URL_FOR_CHAT)
    expect(init.method).toBe("POST")
  })

  test("sends the key as a bearer token and never in the URL", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))

    await clientWith(fetchFn).completeJson("hello")

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).not.toContain(API_KEY)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`)
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
  })

  test("sends the model and prompt and asks for a JSON answer", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))

    await clientWith(fetchFn).completeJson("Parse this resume")

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      model: MODEL,
      messages: [{ role: "user", content: "Parse this resume" }],
      response_format: { type: "json_object" },
    })
  })

  test("refuses to call the API without a key", async () => {
    const fetchFn = fakeFetch(answerBody("{}"))
    const client = new GroqLLMClient({ apiKey: "   ", model: MODEL }, { fetchFn })

    await expect(client.completeJson("hello")).rejects.toThrow("No Groq API key is set")
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe("GroqLLMClient: the answer", () => {
  test("returns the answer parsed as JSON", async () => {
    const client = clientWith(fakeFetch(answerBody('{"firstName":"Pranav","skills":["TypeScript"]}')))

    expect(await client.completeJson("hello")).toEqual({ firstName: "Pranav", skills: ["TypeScript"] })
  })

  test("fails when the answer is not valid JSON", async () => {
    const client = clientWith(fakeFetch(answerBody("Sure! Here is your JSON")))

    await expect(client.completeJson("hello")).rejects.toThrow("Groq did not return valid JSON")
  })

  test("fails when the answer is empty", async () => {
    await expect(clientWith(fakeFetch(answerBody(""))).completeJson("hello")).rejects.toThrow(
      "Groq returned an empty answer",
    )
    await expect(clientWith(fakeFetch(answerBody(null))).completeJson("hello")).rejects.toThrow(
      "Groq returned an empty answer",
    )
  })

  test("fails when the model stopped before finishing", async () => {
    const client = clientWith(fakeFetch(answerBody('{"a":', "length")))

    await expect(client.completeJson("hello")).rejects.toThrow("Groq stopped early (length)")
  })

  test("says so when there is no answer at all", async () => {
    await expect(clientWith(fakeFetch({})).completeJson("hello")).rejects.toThrow("Groq returned no answer")
    await expect(clientWith(fakeFetch({ choices: [] })).completeJson("hello")).rejects.toThrow(
      "Groq returned no answer",
    )
  })
})

describe("GroqLLMClient: errors from the API", () => {
  test("reports the status and Groq's message", async () => {
    const client = clientWith(fakeFetch({ error: { message: "Invalid API Key", type: "invalid_request_error" } }, 401))

    await expect(client.completeJson("hello")).rejects.toThrow("Groq returned 401: Invalid API Key")
  })

  test("falls back to the status text when the error body is not JSON", async () => {
    const fetchFn = vi.fn(async () => new Response("<html>oops</html>", { status: 502, statusText: "Bad Gateway" }))

    await expect(clientWith(fetchFn).completeJson("hello")).rejects.toThrow("Groq returned 502: Bad Gateway")
  })

  test("mentions the rate limit on a 429", async () => {
    const client = clientWith(fakeFetch({ error: { message: "Rate limit reached" } }, 429))

    await expect(client.completeJson("hello")).rejects.toThrow(/rate limit/i)
  })

  test("never puts the key in an error message", async () => {
    const client = clientWith(fakeFetch({ error: { message: "bad request" } }, 400))

    const error = await client.completeJson("hello").catch((caught: Error) => caught)

    expect((error as Error).message).not.toContain(API_KEY)
  })
})

describe("GroqLLMClient: which failures are worth retrying", () => {
  test("marks rate limits and server errors as retryable", async () => {
    for (const status of [429, 500, 503]) {
      const error = await clientWith(fakeFetch({ error: { message: "x" } }, status))
        .completeJson("hello")
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(LLMRequestError)
      expect((error as LLMRequestError).retryable).toBe(true)
    }
  })

  test("marks a missing model or bad key as not retryable", async () => {
    for (const status of [401, 404]) {
      const error = await clientWith(fakeFetch({ error: { message: "x" } }, status))
        .completeJson("hello")
        .catch((caught: unknown) => caught)

      expect((error as LLMRequestError).retryable).toBe(false)
    }
  })

  test("marks a failed connection as retryable", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })

    const error = await clientWith(fetchFn).completeJson("hello").catch((caught: unknown) => caught)

    expect((error as LLMRequestError).retryable).toBe(true)
  })
})

describe("GroqLLMClient: network trouble", () => {
  test("reports a failed connection", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })

    const error = await clientWith(fetchFn).completeJson("hello").catch((caught: Error) => caught)

    expect((error as Error).message).toBe("Could not reach Groq: Failed to fetch")
    expect((error as Error).message).not.toContain(API_KEY)
  })

  test("gives up when Groq takes too long", async () => {
    const hanging = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }),
    )

    await expect(clientWith(hanging as unknown as typeof fetch, 30).completeJson("hello")).rejects.toThrow(
      "Groq did not answer in time",
    )
  })
})

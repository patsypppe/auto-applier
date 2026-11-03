// Tests that LLM request errors say whether trying again might help, and which HTTP statuses count as temporary.
import { describe, expect, test } from "vitest"
import { LLMRequestError, isRetryableStatus } from "./LLMRequestError"

describe("LLMRequestError", () => {
  test("is an Error with the given message and retry flag", () => {
    const error = new LLMRequestError("Gemini returned 503: busy", true)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe("Gemini returned 503: busy")
    expect(error.retryable).toBe(true)
  })
})

describe("isRetryableStatus", () => {
  test("treats rate limits and server trouble as temporary", () => {
    for (const status of [429, 500, 502, 503, 504]) expect(isRetryableStatus(status)).toBe(true)
  })

  test("treats mistakes in the request or access as permanent", () => {
    for (const status of [400, 401, 403, 404]) expect(isRetryableStatus(status)).toBe(false)
  })
})

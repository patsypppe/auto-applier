// Tests that the message guards accept our own messages and reject anything else.
import { emptySummary } from "@auto-applier/core"
import { describe, expect, test } from "vitest"
import { isFillPageRequest, isFillResultMessage, isLlmRequest, isLlmResponse } from "./messaging"

const NOT_OBJECTS = [null, undefined, "text", 42]

describe("isFillPageRequest", () => {
  test("accepts a fill-page request", () => {
    expect(isFillPageRequest({ type: "fill-page" })).toBe(true)
  })

  test("rejects other types and non-objects", () => {
    expect(isFillPageRequest({ type: "llm-complete" })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isFillPageRequest(value)).toBe(false)
  })
})

describe("isFillResultMessage", () => {
  test("accepts a success with a summary", () => {
    expect(isFillResultMessage({ type: "fill-result", result: { ok: true, summary: emptySummary() } })).toBe(true)
  })

  test("accepts a failure with an error text", () => {
    expect(isFillResultMessage({ type: "fill-result", result: { ok: false, error: "No saved profile" } })).toBe(true)
  })

  test("rejects a success whose summary is missing or malformed", () => {
    expect(isFillResultMessage({ type: "fill-result", result: { ok: true } })).toBe(false)
    expect(
      isFillResultMessage({ type: "fill-result", result: { ok: true, summary: { ...emptySummary(), filled: "3" } } }),
    ).toBe(false)
  })

  test("rejects a failure without an error text", () => {
    expect(isFillResultMessage({ type: "fill-result", result: { ok: false } })).toBe(false)
    expect(isFillResultMessage({ type: "fill-result", result: { ok: false, error: 5 } })).toBe(false)
  })

  test("rejects other types and non-objects", () => {
    expect(isFillResultMessage({ type: "fill-page" })).toBe(false)
    expect(isFillResultMessage({ type: "fill-result" })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isFillResultMessage(value)).toBe(false)
  })
})

describe("isLlmRequest", () => {
  test("accepts a request with a prompt", () => {
    expect(isLlmRequest({ type: "llm-complete", prompt: "hello" })).toBe(true)
  })

  test("rejects a missing or non-text prompt", () => {
    expect(isLlmRequest({ type: "llm-complete" })).toBe(false)
    expect(isLlmRequest({ type: "llm-complete", prompt: 5 })).toBe(false)
  })

  test("rejects other types and non-objects", () => {
    expect(isLlmRequest({ type: "fill-page", prompt: "hello" })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isLlmRequest(value)).toBe(false)
  })
})

describe("isLlmResponse", () => {
  test("accepts a success carrying any data, including null", () => {
    expect(isLlmResponse({ ok: true, data: { a: 1 } })).toBe(true)
    expect(isLlmResponse({ ok: true, data: null })).toBe(true)
  })

  test("accepts a failure with an error text", () => {
    expect(isLlmResponse({ ok: false, error: "No key" })).toBe(true)
  })

  test("rejects a failure without a text error", () => {
    expect(isLlmResponse({ ok: false })).toBe(false)
    expect(isLlmResponse({ ok: false, error: 5 })).toBe(false)
  })

  test("rejects values that are not responses", () => {
    expect(isLlmResponse({ data: 1 })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isLlmResponse(value)).toBe(false)
  })
})

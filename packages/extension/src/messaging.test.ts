// Tests that the message guards accept our own messages and reject anything else.
import { emptySummary } from "@auto-applier/core"
import { describe, expect, test } from "vitest"
import {
  isApplyToLinkRequest,
  isAutopilotClearMessage,
  isAutopilotGetRequest,
  isAutopilotResponse,
  isAutopilotSaveMessage,
  isFillAndContinueRequest,
  isFillPageRequest,
  isFillProgressMessage,
  isFillResultMessage,
  isFlowClearMessage,
  isFlowGetRequest,
  isFlowSaveMessage,
  isFlowStateResponse,
  isGetResumeRequest,
  isLlmRequest,
  isLlmResponse,
  isPageLoadedMessage,
  isResumeResponse,
  isStopFlowRequest,
} from "./messaging"

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
    const result = { ok: true, summary: emptySummary(), notes: ["AI help skipped: no key"] }

    expect(isFillResultMessage({ type: "fill-result", result })).toBe(true)
  })

  test("rejects a success whose notes are missing or not text", () => {
    const summary = emptySummary()

    expect(isFillResultMessage({ type: "fill-result", result: { ok: true, summary } })).toBe(false)
    expect(isFillResultMessage({ type: "fill-result", result: { ok: true, summary, notes: [1] } })).toBe(false)
    expect(isFillResultMessage({ type: "fill-result", result: { ok: true, summary, notes: "note" } })).toBe(false)
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

  test("accepts a request that names a known provider", () => {
    expect(isLlmRequest({ type: "llm-complete", prompt: "hello", provider: "groq" })).toBe(true)
    expect(isLlmRequest({ type: "llm-complete", prompt: "hello", provider: "gemini" })).toBe(true)
  })

  test("rejects an unknown provider", () => {
    expect(isLlmRequest({ type: "llm-complete", prompt: "hello", provider: "openai" })).toBe(false)
    expect(isLlmRequest({ type: "llm-complete", prompt: "hello", provider: 5 })).toBe(false)
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

describe("isPageLoadedMessage", () => {
  test("accepts a page-loaded message", () => {
    expect(isPageLoadedMessage({ type: "page-loaded" })).toBe(true)
  })

  test("rejects other types and non-objects", () => {
    expect(isPageLoadedMessage({ type: "fill-page" })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isPageLoadedMessage(value)).toBe(false)
  })
})

describe("isGetResumeRequest", () => {
  test("accepts a get-resume request", () => {
    expect(isGetResumeRequest({ type: "get-resume" })).toBe(true)
  })

  test("rejects other types and non-objects", () => {
    expect(isGetResumeRequest({ type: "llm-complete" })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isGetResumeRequest(value)).toBe(false)
  })
})

describe("isResumeResponse", () => {
  const RESUME = { name: "resume.pdf", mimeType: "application/pdf", data: "JVBERg==" }

  test("accepts a reply with a resume, a reply with none, and a failure with a reason", () => {
    expect(isResumeResponse({ ok: true, resume: RESUME })).toBe(true)
    expect(isResumeResponse({ ok: true })).toBe(true)
    expect(isResumeResponse({ ok: false, error: "nope" })).toBe(true)
  })

  test("rejects a resume with missing or non-text parts", () => {
    expect(isResumeResponse({ ok: true, resume: { ...RESUME, data: 5 } })).toBe(false)
    expect(isResumeResponse({ ok: true, resume: { name: "x" } })).toBe(false)
    expect(isResumeResponse({ ok: true, resume: "text" })).toBe(false)
  })

  test("rejects a failure without a reason, and non-replies", () => {
    expect(isResumeResponse({ ok: false })).toBe(false)
    expect(isResumeResponse({ nothing: true })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isResumeResponse(value)).toBe(false)
  })
})

describe("isFillProgressMessage", () => {
  test("accepts a progress report", () => {
    expect(isFillProgressMessage({ type: "fill-progress", progress: { total: 22, filled: 5, phase: "rules" } })).toBe(true)
  })

  test("rejects other messages and malformed progress", () => {
    expect(isFillProgressMessage({ type: "fill-result" })).toBe(false)
    expect(isFillProgressMessage({ type: "fill-progress" })).toBe(false)
    expect(isFillProgressMessage({ type: "fill-progress", progress: { total: "x", filled: 1, phase: "rules" } })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isFillProgressMessage(value)).toBe(false)
  })
})

describe("flow messages", () => {
  test("accepts the popup's fill-and-continue and stop requests, and nothing else", () => {
    expect(isFillAndContinueRequest({ type: "fill-and-continue" })).toBe(true)
    expect(isStopFlowRequest({ type: "stop-flow" })).toBe(true)
    expect(isFillAndContinueRequest({ type: "fill-page" })).toBe(false)
    expect(isStopFlowRequest({ type: "fill-and-continue" })).toBe(false)
    for (const value of NOT_OBJECTS) {
      expect(isFillAndContinueRequest(value)).toBe(false)
      expect(isStopFlowRequest(value)).toBe(false)
    }
  })

  test("accepts a flow-save message only with a well-formed state", () => {
    expect(isFlowSaveMessage({ type: "flow-save", state: { step: 2, clickedAt: 1000 } })).toBe(true)
    expect(isFlowSaveMessage({ type: "flow-save", state: { step: "2", clickedAt: 1000 } })).toBe(false)
    expect(isFlowSaveMessage({ type: "flow-save", state: { step: 2.5, clickedAt: 1000 } })).toBe(false)
    expect(isFlowSaveMessage({ type: "flow-save" })).toBe(false)
  })

  test("accepts flow-get and flow-clear requests", () => {
    expect(isFlowGetRequest({ type: "flow-get" })).toBe(true)
    expect(isFlowClearMessage({ type: "flow-clear" })).toBe(true)
    expect(isFlowGetRequest({ type: "flow-clear" })).toBe(false)
    expect(isFlowClearMessage(null)).toBe(false)
  })

  test("accepts a reply that holds a state or nothing, and rejects a malformed one", () => {
    expect(isFlowStateResponse({})).toBe(true)
    expect(isFlowStateResponse({ state: { step: 1, clickedAt: 5 } })).toBe(true)
    expect(isFlowStateResponse({ state: { step: -1, clickedAt: 5 } })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isFlowStateResponse(value)).toBe(false)
  })
})

describe("autopilot messages", () => {
  const state = { startedAt: 1000, url: "https://jobs.acme.com/1", applyClicks: 0 }

  test("accepts an apply-to-link request only with a web address", () => {
    expect(isApplyToLinkRequest({ type: "apply-to-link", url: "https://jobs.acme.com/1" })).toBe(true)
    expect(isApplyToLinkRequest({ type: "apply-to-link", url: "" })).toBe(false)
    expect(isApplyToLinkRequest({ type: "apply-to-link", url: 5 })).toBe(false)
    expect(isApplyToLinkRequest({ type: "apply-to-link", url: "x".repeat(3000) })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isApplyToLinkRequest(value)).toBe(false)
  })

  test("accepts a save message only with a well-formed state", () => {
    expect(isAutopilotSaveMessage({ type: "autopilot-save", state })).toBe(true)
    expect(isAutopilotSaveMessage({ type: "autopilot-save", state: { ...state, applyClicks: "0" } })).toBe(false)
    expect(isAutopilotSaveMessage({ type: "autopilot-save", state: { ...state, urlTried: "yes" } })).toBe(false)
    expect(isAutopilotSaveMessage({ type: "autopilot-save" })).toBe(false)
  })

  test("accepts the get and clear requests", () => {
    expect(isAutopilotGetRequest({ type: "autopilot-get" })).toBe(true)
    expect(isAutopilotClearMessage({ type: "autopilot-clear" })).toBe(true)
    expect(isAutopilotGetRequest({ type: "autopilot-clear" })).toBe(false)
  })

  test("accepts a reply holding a state or nothing", () => {
    expect(isAutopilotResponse({})).toBe(true)
    expect(isAutopilotResponse({ state })).toBe(true)
    expect(isAutopilotResponse({ state: { startedAt: "now" } })).toBe(false)
    for (const value of NOT_OBJECTS) expect(isAutopilotResponse(value)).toBe(false)
  })

  test("a flow state may remember that guessing is on", () => {
    expect(isFlowSaveMessage({ type: "flow-save", state: { step: 1, clickedAt: 5, guess: true } })).toBe(true)
    expect(isFlowSaveMessage({ type: "flow-save", state: { step: 1, clickedAt: 5, guess: "yes" } })).toBe(false)
  })
})

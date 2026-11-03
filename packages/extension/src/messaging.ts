// Defines the messages sent between the popup and the content scripts, with guards that check them on arrival.
import { isReportSummary } from "@auto-applier/core"
import type { ReportSummary } from "@auto-applier/core"

export type FillPageRequest = { type: "fill-page" }

export type LlmRequest = { type: "llm-complete"; prompt: string }

export type LlmResponse = { ok: true; data: unknown } | { ok: false; error: string }

export type FillResultMessage = {
  type: "fill-result"
  result: { ok: true; summary: ReportSummary } | { ok: false; error: string }
}

// Returns true when an unknown value is a fill-page request.
export function isFillPageRequest(message: unknown): message is FillPageRequest {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "fill-page"
}

// Returns true when an unknown value is a well-formed fill result.
export function isFillResultMessage(message: unknown): message is FillResultMessage {
  if (typeof message !== "object" || message === null) return false

  const { type, result } = message as { type?: unknown; result?: unknown }
  if (type !== "fill-result" || typeof result !== "object" || result === null) return false

  const outcome = result as { ok?: unknown; summary?: unknown; error?: unknown }
  if (outcome.ok === true) return isReportSummary(outcome.summary)
  return outcome.ok === false && typeof outcome.error === "string"
}

// Returns true when an unknown value is a request to run a prompt through the LLM.
export function isLlmRequest(message: unknown): message is LlmRequest {
  if (typeof message !== "object" || message === null) return false

  const { type, prompt } = message as { type?: unknown; prompt?: unknown }
  return type === "llm-complete" && typeof prompt === "string"
}

// Returns true when an unknown value is a well-formed reply to an LLM request.
export function isLlmResponse(value: unknown): value is LlmResponse {
  if (typeof value !== "object" || value === null) return false

  const { ok, error } = value as { ok?: unknown; error?: unknown }
  if (ok === true) return true
  return ok === false && typeof error === "string"
}

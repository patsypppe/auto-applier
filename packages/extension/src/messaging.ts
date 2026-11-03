// Defines the messages sent between the popup and the content scripts, with guards that check them on arrival.
import { PROVIDER_ORDER, isFillProgress, isReportSummary } from "@auto-applier/core"
import type { FillProgress, ProviderId, ReportSummary } from "@auto-applier/core"

export type FillPageRequest = { type: "fill-page" }

export type PageLoadedMessage = { type: "page-loaded" }

export type GetResumeRequest = { type: "get-resume" }

export type ResumeResponse =
  | { ok: true; resume?: { name: string; mimeType: string; data: string } }
  | { ok: false; error: string }

export type LlmRequest = { type: "llm-complete"; prompt: string; provider?: ProviderId }

export type LlmResponse = { ok: true; data: unknown } | { ok: false; error: string }

export type FillProgressMessage = { type: "fill-progress"; progress: FillProgress }

export type FillResultMessage = {
  type: "fill-result"
  result: { ok: true; summary: ReportSummary; notes: string[] } | { ok: false; error: string }
}

// Returns true when an unknown value is a list of text.
function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

// Returns true when an unknown value is a fill-page request.
export function isFillPageRequest(message: unknown): message is FillPageRequest {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "fill-page"
}

// Returns true when an unknown value is the note a content script sends when its page has loaded.
export function isPageLoadedMessage(message: unknown): message is PageLoadedMessage {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "page-loaded"
}

// Returns true when an unknown value is a request for the saved resume file.
export function isGetResumeRequest(message: unknown): message is GetResumeRequest {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "get-resume"
}

// Returns true when an unknown value is a well-formed reply to a resume request.
export function isResumeResponse(value: unknown): value is ResumeResponse {
  if (typeof value !== "object" || value === null) return false

  const { ok, error, resume } = value as { ok?: unknown; error?: unknown; resume?: unknown }
  if (ok === false) return typeof error === "string"
  if (ok !== true) return false
  if (resume === undefined) return true
  if (typeof resume !== "object" || resume === null) return false

  const { name, mimeType, data } = resume as { name?: unknown; mimeType?: unknown; data?: unknown }
  return typeof name === "string" && typeof mimeType === "string" && typeof data === "string"
}

// Returns true when an unknown value is a well-formed progress report from a content script.
export function isFillProgressMessage(message: unknown): message is FillProgressMessage {
  if (typeof message !== "object" || message === null) return false

  const { type, progress } = message as { type?: unknown; progress?: unknown }
  return type === "fill-progress" && isFillProgress(progress)
}

// Returns true when an unknown value is a well-formed fill result.
export function isFillResultMessage(message: unknown): message is FillResultMessage {
  if (typeof message !== "object" || message === null) return false

  const { type, result } = message as { type?: unknown; result?: unknown }
  if (type !== "fill-result" || typeof result !== "object" || result === null) return false

  const outcome = result as { ok?: unknown; summary?: unknown; notes?: unknown; error?: unknown }
  if (outcome.ok === true) return isReportSummary(outcome.summary) && isTextList(outcome.notes)
  return outcome.ok === false && typeof outcome.error === "string"
}

// Returns true when an unknown value is a request to run a prompt through the LLM, optionally naming one known provider.
export function isLlmRequest(message: unknown): message is LlmRequest {
  if (typeof message !== "object" || message === null) return false

  const { type, prompt, provider } = message as { type?: unknown; prompt?: unknown; provider?: unknown }
  const providerOk = provider === undefined || PROVIDER_ORDER.includes(provider as ProviderId)
  return type === "llm-complete" && typeof prompt === "string" && providerOk
}

// Returns true when an unknown value is a well-formed reply to an LLM request.
export function isLlmResponse(value: unknown): value is LlmResponse {
  if (typeof value !== "object" || value === null) return false

  const { ok, error } = value as { ok?: unknown; error?: unknown }
  if (ok === true) return true
  return ok === false && typeof error === "string"
}

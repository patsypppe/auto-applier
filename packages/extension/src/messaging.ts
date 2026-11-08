// Defines the messages sent between the popup and the content scripts, with guards that check them on arrival.
import { PROVIDER_ORDER, isFillProgress, isReportSummary } from "@auto-applier/core"
import type { FillProgress, ProviderId, ReportSummary } from "@auto-applier/core"

export type FillPageRequest = { type: "fill-page" }

export type FillAndContinueRequest = { type: "fill-and-continue" }

export type StopFlowRequest = { type: "stop-flow" }

export type FlowState = { step: number; clickedAt: number; guess?: boolean }

export type ApplyToLinkRequest = { type: "apply-to-link"; url: string }

export type AutopilotState = { startedAt: number; url: string; applyClicks: number; urlTried?: boolean; aiTried?: boolean }

export type AutopilotSaveMessage = { type: "autopilot-save"; state: AutopilotState }

export type AutopilotGetRequest = { type: "autopilot-get" }

export type AutopilotClearMessage = { type: "autopilot-clear" }

export type AutopilotResponse = { state?: AutopilotState }

export type ApplyToLinkResponse = { ok: true } | { ok: false; error: string }

export type FlowSaveMessage = { type: "flow-save"; state: FlowState }

export type FlowGetRequest = { type: "flow-get" }

export type FlowClearMessage = { type: "flow-clear" }

export type FlowStateResponse = { state?: FlowState }

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

// Returns true when an unknown value is a message of the given type.
function hasType(message: unknown, type: string): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === type
}

// Returns true when an unknown value is the popup's request to fill this step and carry on to the next.
export function isFillAndContinueRequest(message: unknown): message is FillAndContinueRequest {
  return hasType(message, "fill-and-continue")
}

// Returns true when an unknown value is the popup's request to stop a running flow.
export function isStopFlowRequest(message: unknown): message is StopFlowRequest {
  return hasType(message, "stop-flow")
}

// Returns true when an unknown value is a step count and the time Next was pressed.
function isFlowState(value: unknown): value is FlowState {
  if (typeof value !== "object" || value === null) return false

  const { step, clickedAt, guess } = value as { step?: unknown; clickedAt?: unknown; guess?: unknown }
  const guessOk = guess === undefined || typeof guess === "boolean"
  return typeof step === "number" && Number.isInteger(step) && step >= 0 && typeof clickedAt === "number" && Number.isFinite(clickedAt) && guessOk
}

// Returns true when an unknown value is a content script's request to remember how far a flow has got.
export function isFlowSaveMessage(message: unknown): message is FlowSaveMessage {
  return hasType(message, "flow-save") && isFlowState((message as { state?: unknown }).state)
}

// Returns true when an unknown value is a content script's question about the flow it may have to carry on.
export function isFlowGetRequest(message: unknown): message is FlowGetRequest {
  return hasType(message, "flow-get")
}

// Returns true when an unknown value is a content script's note that its flow has ended.
export function isFlowClearMessage(message: unknown): message is FlowClearMessage {
  return hasType(message, "flow-clear")
}

// Returns true when an unknown value is a well-formed reply to a flow-get request.
export function isFlowStateResponse(value: unknown): value is FlowStateResponse {
  if (typeof value !== "object" || value === null) return false

  const { state } = value as { state?: unknown }
  return state === undefined || isFlowState(state)
}

const MAX_LINK_CHARS = 2048

// Returns true when an unknown value is the popup's request to open a job link and apply.
export function isApplyToLinkRequest(message: unknown): message is ApplyToLinkRequest {
  if (!hasType(message, "apply-to-link")) return false

  const { url } = message as { url?: unknown }
  return typeof url === "string" && url !== "" && url.length <= MAX_LINK_CHARS
}

// Returns true when an unknown value describes how far an apply-by-link run has got.
function isAutopilotState(value: unknown): value is AutopilotState {
  if (typeof value !== "object" || value === null) return false

  const { startedAt, url, applyClicks, urlTried, aiTried } = value as Record<string, unknown>
  const flagOk = (flag: unknown) => flag === undefined || typeof flag === "boolean"
  return (
    typeof startedAt === "number" &&
    Number.isFinite(startedAt) &&
    typeof url === "string" &&
    typeof applyClicks === "number" &&
    Number.isInteger(applyClicks) &&
    applyClicks >= 0 &&
    flagOk(urlTried) &&
    flagOk(aiTried)
  )
}

// Returns true when an unknown value is a content script's request to remember how far an apply-by-link run has got.
export function isAutopilotSaveMessage(message: unknown): message is AutopilotSaveMessage {
  return hasType(message, "autopilot-save") && isAutopilotState((message as { state?: unknown }).state)
}

// Returns true when an unknown value is a content script's question about a run it may have to carry on.
export function isAutopilotGetRequest(message: unknown): message is AutopilotGetRequest {
  return hasType(message, "autopilot-get")
}

// Returns true when an unknown value is a content script's note that its run has ended.
export function isAutopilotClearMessage(message: unknown): message is AutopilotClearMessage {
  return hasType(message, "autopilot-clear")
}

// Returns true when an unknown value is a well-formed reply to an autopilot-get request.
export function isAutopilotResponse(value: unknown): value is AutopilotResponse {
  if (typeof value !== "object" || value === null) return false

  const { state } = value as { state?: unknown }
  return state === undefined || isAutopilotState(state)
}

// Returns true when an unknown value is a well-formed reply to an apply-to-link request.
export function isApplyToLinkResponse(value: unknown): value is ApplyToLinkResponse {
  if (typeof value !== "object" || value === null) return false

  const { ok, error } = value as { ok?: unknown; error?: unknown }
  return ok === true || (ok === false && typeof error === "string")
}

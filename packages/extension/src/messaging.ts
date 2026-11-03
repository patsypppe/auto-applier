// Defines the messages sent between the popup and the content scripts, with guards that check them on arrival.
import { isReportSummary } from "@auto-applier/core"
import type { ReportSummary } from "@auto-applier/core"

export type FillPageRequest = { type: "fill-page" }

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

// Reads the page's host, title and the heading of the form step, as short context for the AI.
import type { PageInfo } from "@auto-applier/core"

const MAX_CHARS = 200
const STEP_SELECTOR = "form h1, form h2, form h3, form legend"

// Collapses whitespace and cuts the text to a safe length.
function tidy(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS)
}

// Returns the host, title and, when the form shows one, the heading of the current step.
export function collectPageInfo(doc: Document, location: { hostname: string }): PageInfo {
  const step = tidy(doc.querySelector(STEP_SELECTOR)?.textContent)
  const info: PageInfo = { host: tidy(location.hostname), title: tidy(doc.title) }
  return step === "" ? info : { ...info, step }
}

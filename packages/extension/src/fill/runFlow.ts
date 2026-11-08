// Fills a multi-step application: fills each step, presses Next between steps, and stops before Submit or whenever the person is needed.
import { runSteps, summarizeReports } from "@auto-applier/core"
import type { FieldReport, LLMClient, LoadResume, ProfileStore, ProgressListener, RescanOptions } from "@auto-applier/core"
import type { FillResultMessage } from "../messaging"
import { highlightFlagged } from "../ui/highlightFlagged"
import type { FlowStatePort } from "./flowState"
import { fillOnce } from "./runFill"

const MAX_LISTED = 10

export type FlowPorts = {
  store: ProfileStore
  llm: LLMClient
  flowState: FlowStatePort
  loadResume?: LoadResume
  onProgress?: ProgressListener
  rescan?: Partial<RescanOptions>
  isStopped?: () => boolean
  startAt?: number
  guessRequired?: boolean
}

// Fills the current step, outlines what needs the person, and throws the reason when it cannot fill at all.
async function fillCurrentStep(ports: FlowPorts) {
  const filled = await fillOnce(ports.store, ports.llm, ports.loadResume, ports.onProgress, ports.rescan, ports.guessRequired)
  if (!filled.ok) throw new Error(filled.error)

  highlightFlagged(filled.reports)
  return { reports: filled.reports, notes: filled.notes }
}

// Returns a note naming the answers the AI had to guess, or nothing when it guessed none.
function guessNote(reports: readonly FieldReport[]): string[] {
  const labels = reports.filter((report) => report.source === "guess").map((report) => report.field.label || report.field.name)
  return labels.length === 0 ? [] : [`The AI guessed these required answers, please check them: ${labels.slice(0, MAX_LISTED).join(", ")}.`]
}

// Runs the whole flow and returns the reply for the popup: the counts over every step and why it stopped; the saved flow state is always forgotten at the end.
export async function runFlow(ports: FlowPorts): Promise<FillResultMessage> {
  try {
    const flow = await runSteps({
      root: document,
      fillStep: () => fillCurrentStep(ports),
      beforeClick: (step) => ports.flowState.save({ step, clickedAt: Date.now(), ...(ports.guessRequired ? { guess: true } : {}) }),
      hostname: () => window.location.hostname,
      isStopped: ports.isStopped,
      startAt: ports.startAt,
    })
    const reports = flow.steps.flatMap((step) => step.reports)
    return { type: "fill-result", result: { ok: true, summary: summarizeReports(reports), notes: [`Stopped: ${flow.end.detail}`, ...guessNote(reports), ...flow.notes] } }
  } catch (error: unknown) {
    return { type: "fill-result", result: { ok: false, error: error instanceof Error ? error.message : "Filling failed" } }
  } finally {
    await ports.flowState.clear().catch(() => undefined)
  }
}

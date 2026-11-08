// Runs one fill of the current page and returns the reply for the popup, whatever happens along the way.
import { DEFAULT_SETUP, FileFiller, fillPageWithAssistant, summarizeReports, validateProfile } from "@auto-applier/core"
import type { FieldReport, LLMClient, LoadResume, ProfileStore, ProgressListener, RescanOptions } from "@auto-applier/core"
import type { FillResultMessage } from "../messaging"
import { collectJobContext } from "../page/collectJobContext"
import { collectPageInfo } from "../page/collectPageInfo"
import { highlightFlagged } from "../ui/highlightFlagged"

// Wraps an error text in the message the popup expects.
function failure(error: string): FillResultMessage {
  return { type: "fill-result", result: { ok: false, error } }
}

// Used when no way of fetching the resume is given: there is no file to attach.
const NO_RESUME: LoadResume = async () => undefined

export type FillOnce = { ok: true; reports: FieldReport[]; notes: string[] } | { ok: false; error: string }

// Fills this page once from the saved profile, with the LLM's help where the rules cannot decide and again for fields that appear, attaching the saved resume to a resume upload; returns what happened to each field.
export async function fillOnce(
  store: ProfileStore,
  llm: LLMClient,
  loadResume: LoadResume = NO_RESUME,
  onProgress?: ProgressListener,
  rescan?: Partial<RescanOptions>,
): Promise<FillOnce> {
  const saved = await store.load()
  if (!saved) return { ok: false, error: "No saved profile yet. Fill in and save the form in this popup first." }

  const checked = validateProfile(saved)
  if (!checked.ok) return { ok: false, error: `Your saved profile needs fixing: ${checked.errors.join("; ")}` }

  const { reports, notes } = await fillPageWithAssistant(document, checked.profile, llm, {
    setup: { ...DEFAULT_SETUP, fillers: [...DEFAULT_SETUP.fillers, new FileFiller(loadResume)] },
    jobContext: collectJobContext(document),
    page: collectPageInfo(document, window.location),
    rescan,
    onProgress,
  })
  return { ok: true, reports, notes }
}

// Fills this page once, tells the listener how far it has got, outlines what needs the user, and returns the reply for the popup whatever happens along the way.
export async function runFill(
  store: ProfileStore,
  llm: LLMClient,
  loadResume: LoadResume = NO_RESUME,
  onProgress?: ProgressListener,
  rescan?: Partial<RescanOptions>,
): Promise<FillResultMessage> {
  try {
    const filled = await fillOnce(store, llm, loadResume, onProgress, rescan)
    if (!filled.ok) return failure(filled.error)

    highlightFlagged(filled.reports)
    return { type: "fill-result", result: { ok: true, summary: summarizeReports(filled.reports), notes: filled.notes } }
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : "Filling failed")
  }
}

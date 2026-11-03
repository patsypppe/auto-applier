// Runs one fill of the current page and returns the reply for the popup, whatever happens along the way.
import { DEFAULT_SETUP, FileFiller, fillPageWithAssistant, summarizeReports, validateProfile } from "@auto-applier/core"
import type { LLMClient, LoadResume, ProfileStore } from "@auto-applier/core"
import type { FillResultMessage } from "../messaging"
import { collectJobContext } from "../page/collectJobContext"
import { highlightFlagged } from "../ui/highlightFlagged"

// Wraps an error text in the message the popup expects.
function failure(error: string): FillResultMessage {
  return { type: "fill-result", result: { ok: false, error } }
}

// Used when no way of fetching the resume is given: there is no file to attach.
const NO_RESUME: LoadResume = async () => undefined

// Fills this page from the saved profile, with the LLM's help where the rules cannot decide, attaching the saved resume to a resume upload, and outlines what needs the user.
export async function runFill(store: ProfileStore, llm: LLMClient, loadResume: LoadResume = NO_RESUME): Promise<FillResultMessage> {
  try {
    const saved = await store.load()
    if (!saved) return failure("No saved profile yet. Fill in and save the form in this popup first.")

    const checked = validateProfile(saved)
    if (!checked.ok) return failure(`Your saved profile needs fixing: ${checked.errors.join("; ")}`)

    const { reports, notes } = await fillPageWithAssistant(document, checked.profile, llm, {
      setup: { ...DEFAULT_SETUP, fillers: [...DEFAULT_SETUP.fillers, new FileFiller(loadResume)] },
      jobContext: collectJobContext(document),
    })
    highlightFlagged(reports)
    return { type: "fill-result", result: { ok: true, summary: summarizeReports(reports), notes } }
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : "Filling failed")
  }
}

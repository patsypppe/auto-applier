// Runs one fill of the current page and returns the reply for the popup, whatever happens along the way.
import { fillPageWithAssistant, summarizeReports, validateProfile } from "@auto-applier/core"
import type { LLMClient, ProfileStore } from "@auto-applier/core"
import type { FillResultMessage } from "../messaging"
import { collectJobContext } from "../page/collectJobContext"
import { highlightFlagged } from "../ui/highlightFlagged"

// Wraps an error text in the message the popup expects.
function failure(error: string): FillResultMessage {
  return { type: "fill-result", result: { ok: false, error } }
}

// Fills this page from the saved profile, with the LLM's help where the rules cannot decide, and outlines what needs the user.
export async function runFill(store: ProfileStore, llm: LLMClient): Promise<FillResultMessage> {
  try {
    const saved = await store.load()
    if (!saved) return failure("No saved profile yet. Fill in and save the form in this popup first.")

    const checked = validateProfile(saved)
    if (!checked.ok) return failure(`Your saved profile needs fixing: ${checked.errors.join("; ")}`)

    const { reports, notes } = await fillPageWithAssistant(document, checked.profile, llm, {
      jobContext: collectJobContext(document),
    })
    highlightFlagged(reports)
    return { type: "fill-result", result: { ok: true, summary: summarizeReports(reports), notes } }
  } catch (error: unknown) {
    return failure(error instanceof Error ? error.message : "Filling failed")
  }
}

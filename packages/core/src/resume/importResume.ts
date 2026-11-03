// Reads a resume with the LLM and decides what happens next: a profile ready to save, or form values for the user to review.
import type { LLMClient } from "../ports/LLMClient"
import type { CarriedOver, ProfileFormValues } from "../profile/formValues"
import type { Profile } from "../profile/types"
import { applyDraftToFormValues, buildProfileFromDraft, carryOverFromDraft } from "./applyDraft"
import { parseResume } from "./parseResume"
import type { ProfileDraft } from "./types"

export type ImportOutcome =
  | { status: "ready"; profile: Profile; draft: ProfileDraft; warnings: string[] }
  | {
      status: "needs-review"
      values: ProfileFormValues
      carried: CarriedOver
      draft: ProfileDraft
      errors: string[]
      warnings: string[]
    }

// Parses the resume text, then returns a valid profile to save, or the filled-in form and the reasons it is not valid yet.
export async function importResume(
  resumeText: string,
  llm: LLMClient,
  current: ProfileFormValues,
  previous?: CarriedOver,
): Promise<ImportOutcome> {
  const { draft, warnings } = await parseResume(resumeText, llm)

  const built = buildProfileFromDraft(draft, current, previous)
  if (built.ok) return { status: "ready", profile: built.profile, draft, warnings }

  return {
    status: "needs-review",
    values: applyDraftToFormValues(draft, current),
    carried: carryOverFromDraft(draft, previous),
    draft,
    errors: built.errors,
    warnings,
  }
}

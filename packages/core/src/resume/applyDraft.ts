// Puts a parsed resume draft into the profile form values, and builds a validated profile from it.
import { fromFormValues } from "../profile/formValues"
import type { CarriedOver, ProfileFormValues } from "../profile/formValues"
import type { ValidationResult } from "../profile/schema"
import type { ProfileDraft } from "./types"

// Returns new form values where the draft's non-empty details replace the matching fields and everything else is kept.
export function applyDraftToFormValues(draft: ProfileDraft, current: ProfileFormValues): ProfileFormValues {
  const { personal, skills } = draft

  return {
    ...current,
    firstName: personal.firstName || current.firstName,
    middleName: personal.middleName || current.middleName,
    lastName: personal.lastName || current.lastName,
    email: personal.email || current.email,
    phone: personal.phone || current.phone,
    city: personal.city || current.city,
    state: personal.state || current.state,
    country: personal.country || current.country,
    linkedin: personal.links.linkedin || current.linkedin,
    github: personal.links.github || current.github,
    portfolio: personal.links.portfolio || current.portfolio,
    skills: skills.length > 0 ? skills.join(", ") : current.skills,
  }
}

// Returns what to keep alongside the form: the draft's jobs and degrees when it has any, otherwise the previous ones, plus the previous resume file.
export function carryOverFromDraft(draft: ProfileDraft, previous?: CarriedOver): CarriedOver {
  return {
    experience: draft.experience.length > 0 ? draft.experience : (previous?.experience ?? []),
    education: draft.education.length > 0 ? draft.education : (previous?.education ?? []),
    resume: previous?.resume,
  }
}

// Builds and validates a profile from the draft, the current form values and what was previously carried over.
export function buildProfileFromDraft(
  draft: ProfileDraft,
  current: ProfileFormValues,
  previous?: CarriedOver,
): ValidationResult {
  return fromFormValues(applyDraftToFormValues(draft, current), carryOverFromDraft(draft, previous))
}

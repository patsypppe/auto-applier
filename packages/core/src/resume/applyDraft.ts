// Puts a parsed resume draft into the profile form values, and builds a validated profile from it.
import { fromFormValues } from "../profile/formValues"
import type { ProfileFormValues } from "../profile/formValues"
import { validateProfile } from "../profile/schema"
import type { ValidationResult } from "../profile/schema"
import type { Profile } from "../profile/types"
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
    linkedin: personal.links.linkedin || current.linkedin,
    github: personal.links.github || current.github,
    portfolio: personal.links.portfolio || current.portfolio,
    skills: skills.length > 0 ? skills.join(", ") : current.skills,
  }
}

// Builds and validates a profile from the draft and the current form values; the draft's jobs and degrees replace the saved ones when it has any.
export function buildProfileFromDraft(
  draft: ProfileDraft,
  current: ProfileFormValues,
  existing?: Profile,
): ValidationResult {
  const built = fromFormValues(applyDraftToFormValues(draft, current), existing)
  if (!built.ok) return built

  return validateProfile({
    ...built.profile,
    experience: draft.experience.length > 0 ? draft.experience : built.profile.experience,
    education: draft.education.length > 0 ? draft.education : built.profile.education,
  })
}

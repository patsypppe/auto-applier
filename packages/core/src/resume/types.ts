// Describes what is read from a resume: a draft of the profile that the user reviews before it is saved.
import type { Education, Links, WorkExperience } from "../profile/types"

export type ProfileDraft = {
  personal: {
    firstName: string
    middleName: string
    lastName: string
    email: string
    phone: string
    city: string
    state: string
    country: string
    links: Links
  }
  experience: WorkExperience[]
  education: Education[]
  skills: string[]
}

export type ParsedResume = {
  draft: ProfileDraft
  warnings: string[]
}

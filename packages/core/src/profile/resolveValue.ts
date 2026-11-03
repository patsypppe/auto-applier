// Turns a profile key into the text value to put in a form field.
import { currentEducation, currentJob } from "./history"
import type { ProfileKey } from "./keys"
import { locationText } from "./location"
import { fullName, legalName, preferredName } from "./names"
import type { Profile } from "./types"

const RESOLVERS: Record<ProfileKey, (profile: Profile) => string | undefined> = {
  firstName: (profile) => profile.personal.firstName,
  middleName: (profile) => profile.personal.middleName,
  lastName: (profile) => profile.personal.lastName,
  fullName: (profile) => fullName(profile.personal),
  legalName: (profile) => legalName(profile.personal),
  preferredName: (profile) => preferredName(profile.personal),
  email: (profile) => profile.personal.email,
  phone: (profile) => profile.personal.phone,
  linkedin: (profile) => profile.personal.links.linkedin,
  github: (profile) => profile.personal.links.github,
  portfolio: (profile) => profile.personal.links.portfolio,
  skills: (profile) => profile.skills.join(", ") || undefined,
  workAuthorization: (profile) => profile.answers.workAuthorization,
  needsSponsorship: (profile) => (profile.answers.needsSponsorship ? "Yes" : "No"),
  isAuthorizedToWork: (profile) => (profile.answers.isAuthorizedToWork ? "Yes" : "No"),
  plansToWorkRemotely: (profile) => {
    const { plansToWorkRemotely } = profile.answers
    return plansToWorkRemotely === undefined ? undefined : plansToWorkRemotely ? "Yes" : "No"
  },
  noticePeriod: (profile) => profile.answers.noticePeriod,
  salaryExpectation: (profile) => profile.answers.salaryExpectation,
  currentCompany: (profile) => currentJob(profile.experience)?.company,
  currentTitle: (profile) => currentJob(profile.experience)?.title,
  school: (profile) => currentEducation(profile.education)?.school,
  degree: (profile) => currentEducation(profile.education)?.degree,
  fieldOfStudy: (profile) => currentEducation(profile.education)?.field,
  city: (profile) => profile.personal.city,
  state: (profile) => profile.personal.state,
  country: (profile) => profile.personal.country,
  location: (profile) => locationText(profile.personal),
  resume: (profile) => profile.resume?.name,
}

// Returns the profile's value for the key, or undefined when the profile has none.
export function resolveValue(profile: Profile, key: ProfileKey): string | undefined {
  return RESOLVERS[key](profile)
}

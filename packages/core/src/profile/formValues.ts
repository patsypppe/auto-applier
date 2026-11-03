// Converts between the flat text values of the profile form and a Profile.
import { validateProfile } from "./schema"
import type { ValidationResult } from "./schema"
import type { Profile } from "./types"

export type ProfileFormValues = {
  firstName: string
  middleName: string
  lastName: string
  legalName: string
  preferredName: string
  email: string
  phone: string
  city: string
  state: string
  country: string
  linkedin: string
  github: string
  portfolio: string
  skills: string
  workAuthorization: string
  needsSponsorship: "yes" | "no"
  isAuthorizedToWork: "yes" | "no"
  noticePeriod: string
  salaryExpectation: string
}

// The parts of a profile the form does not edit, which are kept when the form is saved.
export type CarriedOver = Pick<Profile, "experience" | "education" | "resume">

// Picks out the parts of a profile that the form does not edit.
export function carriedOverOf(profile: Profile): CarriedOver {
  return { experience: profile.experience, education: profile.education, resume: profile.resume }
}

// Returns form values with every text blank and sponsorship set to no.
export function emptyFormValues(): ProfileFormValues {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    legalName: "",
    preferredName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    linkedin: "",
    github: "",
    portfolio: "",
    skills: "",
    workAuthorization: "",
    needsSponsorship: "no",
    isAuthorizedToWork: "yes",
    noticePeriod: "",
    salaryExpectation: "",
  }
}

// Returns the trimmed text, or undefined when it is blank so the field is left out.
function optionalText(text: string): string | undefined {
  const trimmed = text.trim()
  return trimmed === "" ? undefined : trimmed
}

// Flattens a profile into form text, joining skills with commas.
export function toFormValues(profile: Profile): ProfileFormValues {
  const { personal, answers } = profile
  return {
    firstName: personal.firstName,
    middleName: personal.middleName ?? "",
    lastName: personal.lastName,
    legalName: personal.legalName ?? "",
    preferredName: personal.preferredName ?? "",
    email: personal.email,
    phone: personal.phone,
    city: personal.city ?? "",
    state: personal.state ?? "",
    country: personal.country ?? "",
    linkedin: personal.links.linkedin ?? "",
    github: personal.links.github ?? "",
    portfolio: personal.links.portfolio ?? "",
    skills: profile.skills.join(", "),
    workAuthorization: answers.workAuthorization,
    needsSponsorship: answers.needsSponsorship ? "yes" : "no",
    isAuthorizedToWork: answers.isAuthorizedToWork ? "yes" : "no",
    noticePeriod: answers.noticePeriod ?? "",
    salaryExpectation: answers.salaryExpectation ?? "",
  }
}

// Builds and validates a profile from form text, keeping experience, education and resume from what is carried over.
export function fromFormValues(values: ProfileFormValues, existing?: CarriedOver): ValidationResult {
  return validateProfile({
    personal: {
      firstName: values.firstName.trim(),
      middleName: optionalText(values.middleName),
      lastName: values.lastName.trim(),
      legalName: optionalText(values.legalName),
      preferredName: optionalText(values.preferredName),
      email: values.email.trim(),
      phone: values.phone.trim(),
      city: optionalText(values.city),
      state: optionalText(values.state),
      country: optionalText(values.country),
      links: {
        linkedin: optionalText(values.linkedin),
        github: optionalText(values.github),
        portfolio: optionalText(values.portfolio),
      },
    },
    experience: existing?.experience ?? [],
    education: existing?.education ?? [],
    skills: values.skills
      .split(",")
      .map((skill) => skill.trim())
      .filter((skill) => skill !== ""),
    answers: {
      workAuthorization: values.workAuthorization.trim(),
      needsSponsorship: values.needsSponsorship === "yes",
      isAuthorizedToWork: values.isAuthorizedToWork === "yes",
      noticePeriod: optionalText(values.noticePeriod),
      salaryExpectation: optionalText(values.salaryExpectation),
    },
    resume: existing?.resume,
  })
}

// Lists every profile key a form field can be matched to.
export const PROFILE_KEYS = [
  "firstName",
  "middleName",
  "lastName",
  "fullName",
  "legalName",
  "preferredName",
  "email",
  "phone",
  "linkedin",
  "github",
  "portfolio",
  "skills",
  "workAuthorization",
  "needsSponsorship",
  "isAuthorizedToWork",
  "noticePeriod",
  "salaryExpectation",
] as const

export type ProfileKey = (typeof PROFILE_KEYS)[number]

export type Links = {
  linkedin?: string
  github?: string
  portfolio?: string
}

export type PersonalInfo = {
  firstName: string
  middleName?: string
  lastName: string
  legalName?: string
  preferredName?: string
  email: string
  phone: string
  links: Links
}

export type WorkExperience = {
  company: string
  title: string
  startDate: string
  endDate?: string
  description: string
}

export type Education = {
  school: string
  degree: string
  field?: string
  startDate: string
  endDate?: string
}

export type StandardAnswers = {
  workAuthorization: string
  needsSponsorship: boolean
  noticePeriod?: string
  salaryExpectation?: string
}

export type ResumeFile = {
  name: string
  mimeType: string
  storageKey: string
}

export type Profile = {
  personal: PersonalInfo
  experience: WorkExperience[]
  education: Education[]
  skills: string[]
  answers: StandardAnswers
  resume?: ResumeFile
}

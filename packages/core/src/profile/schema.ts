// Zod schema for the profile, used to validate user input and LLM output before it is saved.
import * as z from "zod/mini"
import en from "zod/v4/locales/en.js"
import type { Profile } from "./types"

// Only the English messages are loaded: the full set of languages would add about 400 KB to every page.
z.config(en())

const requiredText = z.string().check(z.minLength(1))
const optionalText = z.optional(z.string())

const linksSchema = z.object({
  linkedin: optionalText,
  github: optionalText,
  portfolio: optionalText,
})

const personalInfoSchema = z.object({
  firstName: requiredText,
  middleName: optionalText,
  lastName: requiredText,
  legalName: optionalText,
  preferredName: optionalText,
  email: z.email(),
  phone: requiredText,
  links: linksSchema,
})

const workExperienceSchema = z.object({
  company: requiredText,
  title: requiredText,
  startDate: requiredText,
  endDate: optionalText,
  description: z.string(),
})

const educationSchema = z.object({
  school: requiredText,
  degree: requiredText,
  field: optionalText,
  startDate: requiredText,
  endDate: optionalText,
})

const standardAnswersSchema = z.object({
  workAuthorization: requiredText,
  needsSponsorship: z.boolean(),
  isAuthorizedToWork: z.boolean(),
  noticePeriod: optionalText,
  salaryExpectation: optionalText,
})

const resumeFileSchema = z.object({
  name: requiredText,
  mimeType: requiredText,
  storageKey: requiredText,
})

export const profileSchema = z.object({
  personal: personalInfoSchema,
  experience: z.array(workExperienceSchema),
  education: z.array(educationSchema),
  skills: z.array(z.string()),
  answers: standardAnswersSchema,
  resume: z.optional(resumeFileSchema),
})

export type ValidationResult =
  | { ok: true; profile: Profile }
  | { ok: false; errors: string[] }

// Checks unknown input against the schema and returns a profile or readable "path: message" errors.
export function validateProfile(input: unknown): ValidationResult {
  const result = profileSchema.safeParse(input)
  if (result.success) return { ok: true, profile: result.data }

  const errors = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
  return { ok: false, errors }
}

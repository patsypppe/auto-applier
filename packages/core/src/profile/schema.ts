// Zod schema for the profile, used to validate user input and LLM output before it is saved.
import { z } from "zod"
import type { Profile } from "./types"

const requiredText = z.string().min(1)

const linksSchema = z.object({
  linkedin: z.string().optional(),
  github: z.string().optional(),
  portfolio: z.string().optional(),
})

const personalInfoSchema = z.object({
  firstName: requiredText,
  middleName: z.string().optional(),
  lastName: requiredText,
  legalName: z.string().optional(),
  preferredName: z.string().optional(),
  email: z.email(),
  phone: requiredText,
  links: linksSchema,
})

const workExperienceSchema = z.object({
  company: requiredText,
  title: requiredText,
  startDate: requiredText,
  endDate: z.string().optional(),
  description: z.string(),
})

const educationSchema = z.object({
  school: requiredText,
  degree: requiredText,
  field: z.string().optional(),
  startDate: requiredText,
  endDate: z.string().optional(),
})

const standardAnswersSchema = z.object({
  workAuthorization: requiredText,
  needsSponsorship: z.boolean(),
  noticePeriod: z.string().optional(),
  salaryExpectation: z.string().optional(),
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
  resume: resumeFileSchema.optional(),
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

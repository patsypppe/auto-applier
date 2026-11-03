// Describes each input on the profile form: which value it edits, its label and its input type.
import type { ProfileFormValues } from "@auto-applier/core"

export type FieldSpec = {
  key: keyof ProfileFormValues
  label: string
  type: "text" | "email" | "tel" | "yesno"
  required?: boolean
}

export const PROFILE_FIELDS: FieldSpec[] = [
  { key: "firstName", label: "First name", type: "text", required: true },
  { key: "middleName", label: "Middle name", type: "text" },
  { key: "lastName", label: "Last name", type: "text", required: true },
  { key: "legalName", label: "Legal name (if different)", type: "text" },
  { key: "preferredName", label: "Preferred name (if different)", type: "text" },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "tel", required: true },
  { key: "linkedin", label: "LinkedIn", type: "text" },
  { key: "github", label: "GitHub", type: "text" },
  { key: "portfolio", label: "Portfolio", type: "text" },
  { key: "skills", label: "Skills (comma separated)", type: "text" },
  { key: "workAuthorization", label: "Work authorization", type: "text", required: true },
  { key: "needsSponsorship", label: "Needs visa sponsorship", type: "yesno" },
  { key: "noticePeriod", label: "Notice period", type: "text" },
  { key: "salaryExpectation", label: "Salary expectation", type: "text" },
]

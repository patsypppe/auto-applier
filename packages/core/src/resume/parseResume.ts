// Reads a resume with the LLM and turns its answer into a clean, checked draft of the profile.
import * as z from "zod/mini"
import type { LLMClient } from "../ports/LLMClient"
import type { Education, Links, WorkExperience } from "../profile/types"
import { buildResumePrompt, MAX_RESUME_CHARS } from "./resumePrompt"
import type { ParsedResume } from "./types"

const text = z.nullish(z.string())

const rawResumeSchema = z.object({
  firstName: text,
  middleName: text,
  lastName: text,
  email: text,
  phone: text,
  city: text,
  state: text,
  country: text,
  linkedin: text,
  github: text,
  portfolio: text,
  skills: z.nullish(z.union([z.array(z.string()), z.string()])),
  experience: z.nullish(
    z.array(z.object({ company: text, title: text, startDate: text, endDate: text, description: text })),
  ),
  education: z.nullish(
    z.array(z.object({ school: text, degree: text, field: text, startDate: text, endDate: text })),
  ),
})

type RawResume = z.infer<typeof rawResumeSchema>
type RawJob = NonNullable<RawResume["experience"]>[number]
type RawDegree = NonNullable<RawResume["education"]>[number]
type Outcome<T> = { item: T } | { warning: string }

const CURRENT_MARKERS = new Set(["present", "current", "now", "ongoing", "to date"])

// Trims text, treating a missing value as empty.
function clean(value: string | null | undefined): string {
  return (value ?? "").trim()
}

// Returns the trimmed text, or undefined when it is blank.
function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = clean(value)
  return trimmed === "" ? undefined : trimmed
}

// Returns an end date, or undefined when it is blank or a marker like "Present" for something still going on.
function endDateOf(value: string | null | undefined): string | undefined {
  const date = optionalText(value)
  return date && CURRENT_MARKERS.has(date.toLowerCase()) ? undefined : date
}

// Reads skills given as a list or as one comma or line separated string, dropping blanks and repeats.
function skillsFrom(value: string[] | string | null | undefined): string[] {
  const items = typeof value === "string" ? value.split(/[,\n]/) : (value ?? [])
  const seen = new Set<string>()

  return items.map(clean).filter((skill) => {
    const key = skill.toLowerCase()
    if (skill === "" || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Lists the labels of the required details that are blank.
function blankLabels(details: [label: string, value: string][]): string[] {
  return details.filter(([, value]) => value === "").map(([label]) => label)
}

// Splits outcomes into the items that were kept and the warnings about the ones that were dropped.
function collect<T>(outcomes: Outcome<T>[]): { items: T[]; warnings: string[] } {
  return {
    items: outcomes.flatMap((outcome) => ("item" in outcome ? [outcome.item] : [])),
    warnings: outcomes.flatMap((outcome) => ("warning" in outcome ? [outcome.warning] : [])),
  }
}

// Turns one job into a work experience, or a warning when a required detail is missing.
function toExperience(raw: RawJob, index: number): Outcome<WorkExperience> {
  const endDate = endDateOf(raw.endDate)
  const startDate = clean(raw.startDate) || endDate || ""
  const blank = blankLabels([
    ["company", clean(raw.company)],
    ["title", clean(raw.title)],
    ["start date", startDate],
  ])
  if (blank.length > 0) return { warning: `Skipped work experience #${index + 1}: missing ${blank.join(", ")}.` }

  return {
    item: {
      company: clean(raw.company),
      title: clean(raw.title),
      startDate,
      endDate,
      description: clean(raw.description),
    },
  }
}

// Turns one degree into an education entry, or a warning when a required detail is missing.
function toEducation(raw: RawDegree, index: number): Outcome<Education> {
  const endDate = endDateOf(raw.endDate)
  const startDate = clean(raw.startDate) || endDate || ""
  const blank = blankLabels([
    ["school", clean(raw.school)],
    ["degree", clean(raw.degree)],
    ["start date", startDate],
  ])
  if (blank.length > 0) return { warning: `Skipped education #${index + 1}: missing ${blank.join(", ")}.` }

  return {
    item: {
      school: clean(raw.school),
      degree: clean(raw.degree),
      field: optionalText(raw.field),
      startDate,
      endDate,
    },
  }
}

// Asks the LLM to read the resume text and returns a cleaned draft plus warnings about anything left out.
export async function parseResume(resumeText: string, llm: LLMClient): Promise<ParsedResume> {
  const trimmed = resumeText.trim()
  if (trimmed === "") {
    throw new Error("The resume has no text to read. A scanned or image-only PDF cannot be parsed.")
  }

  const tooLong = trimmed.length > MAX_RESUME_CHARS
  const answer = await llm.completeJson(buildResumePrompt(tooLong ? trimmed.slice(0, MAX_RESUME_CHARS) : trimmed))

  const parsed = rawResumeSchema.safeParse(answer)
  if (!parsed.success) throw new Error("The model's answer did not look like a resume. Try again.")

  const raw = parsed.data
  const jobs = collect((raw.experience ?? []).map(toExperience))
  const degrees = collect((raw.education ?? []).map(toEducation))
  const links: Links = {
    linkedin: optionalText(raw.linkedin),
    github: optionalText(raw.github),
    portfolio: optionalText(raw.portfolio),
  }
  const lengthWarning = tooLong
    ? [`The resume is very long, so only the first ${MAX_RESUME_CHARS} characters were read.`]
    : []

  return {
    draft: {
      personal: {
        firstName: clean(raw.firstName),
        middleName: clean(raw.middleName),
        lastName: clean(raw.lastName),
        email: clean(raw.email),
        phone: clean(raw.phone),
        city: clean(raw.city),
        state: clean(raw.state),
        country: clean(raw.country),
        links,
      },
      experience: jobs.items,
      education: degrees.items,
      skills: skillsFrom(raw.skills),
    },
    warnings: [...lengthWarning, ...jobs.warnings, ...degrees.warnings],
  }
}

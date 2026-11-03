// Imports an uploaded resume file: reads its text, asks the LLM, stores the file, then saves the profile or returns it for review.
import { importResume } from "@auto-applier/core"
import type {
  CarriedOver,
  LLMClient,
  Profile,
  ProfileFormValues,
  ProfileStore,
  ResumeFile,
  ResumeStore,
} from "@auto-applier/core"
import { extractResumeText, isPdf } from "./extractResumeText"
import type { PdfReader } from "./extractResumeText"
import { RESUME_KEY } from "./resumeKey"

export { RESUME_KEY }

export type ImportDeps = {
  readPdf: PdfReader
  llm: LLMClient
  resumes: ResumeStore
  profiles: ProfileStore
}

export type FileImportOutcome =
  | { status: "saved"; profile: Profile; warnings: string[] }
  | {
      status: "needs-review"
      values: ProfileFormValues
      carried: CarriedOver
      errors: string[]
      warnings: string[]
    }

// Describes where the file is stored, working out the type from the name when the browser gives none.
function pointerFor(file: File): ResumeFile {
  const mimeType = file.type || (isPdf(file) ? "application/pdf" : "text/plain")
  return { name: file.name, mimeType, storageKey: RESUME_KEY }
}

// Reads the resume, and only once that has worked stores the file, so a failure leaves the earlier resume untouched.
// A complete result is saved as the profile; an incomplete one is returned so the user can finish it in the form.
export async function importResumeFile(
  file: File,
  current: ProfileFormValues,
  previous: CarriedOver | undefined,
  deps: ImportDeps,
): Promise<FileImportOutcome> {
  const text = await extractResumeText(file, deps.readPdf)
  const outcome = await importResume(text, deps.llm, current, previous)

  const resume = pointerFor(file)
  await deps.resumes.save(RESUME_KEY, { name: resume.name, mimeType: resume.mimeType, data: await file.arrayBuffer() })

  if (outcome.status === "ready") {
    const profile: Profile = { ...outcome.profile, resume }
    await deps.profiles.save(profile)
    return { status: "saved", profile, warnings: outcome.warnings }
  }

  return {
    status: "needs-review",
    values: outcome.values,
    carried: { ...outcome.carried, resume },
    errors: outcome.errors,
    warnings: outcome.warnings,
  }
}

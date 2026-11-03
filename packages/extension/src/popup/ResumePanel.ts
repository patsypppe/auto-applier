// Renders the resume upload control, shows what was found in the resume, and hands the result to the profile form.
import { describeHistory } from "@auto-applier/core"
import type { CarriedOver, Education, ProfileFormValues, WorkExperience } from "@auto-applier/core"
import type { FileImportOutcome } from "../resume/importResumeFile"
import type { ProfileFormHandle } from "./ProfileForm"

export type ResumePanelOptions = {
  form: ProfileFormHandle
  importFile: (file: File, current: ProfileFormValues, carried: CarriedOver | undefined) => Promise<FileImportOutcome>
}

const READING_MESSAGE = "Reading your resume…"
const SAVED_MESSAGE = "Resume read and your profile was saved. Please check the details below."
const REVIEW_MESSAGE = "Resume read, but your profile is not complete yet. Fix the items below and press Save."

// Creates a list with one item per line of text.
function createList(lines: string[]): HTMLUListElement {
  const list = document.createElement("ul")
  list.append(
    ...lines.map((line) => {
      const item = document.createElement("li")
      item.textContent = line
      return item
    }),
  )
  return list
}

// Shows the warnings and a read-only summary of the jobs and degrees found, or nothing when there are none.
function showFindings(
  findings: HTMLElement,
  warnings: string[],
  experience: WorkExperience[],
  education: Education[],
): void {
  const { jobs, degrees } = describeHistory(experience, education)
  const parts: HTMLElement[] = []

  if (warnings.length > 0) {
    const list = createList(warnings)
    list.className = "warnings"
    parts.push(list)
  }
  if (jobs.length + degrees.length > 0) {
    const heading = document.createElement("p")
    heading.textContent = "Found in your resume (not editable yet):"
    parts.push(heading, createList([...jobs, ...degrees]))
  }

  findings.replaceChildren(...parts)
}

// Returns the line that names the stored resume, or says there is none; a resume not yet linked to a saved profile says so.
function storedLine(name: string | undefined, linked: boolean): string {
  if (!name) return "No resume stored yet."
  return linked ? `Stored resume: ${name}` : `Stored resume: ${name} (press Save profile to keep it linked)`
}

// Adds a file input and a status area to the container; a chosen file is imported and the result shown in the form.
export function mountResumePanel(container: HTMLElement, options: ResumePanelOptions): void {
  const { form, importFile } = options

  const input = document.createElement("input")
  input.id = "resume-file"
  input.type = "file"
  input.accept = ".pdf,.txt,.md,application/pdf,text/plain"

  const label = document.createElement("label")
  label.htmlFor = "resume-file"
  label.textContent = "Fill your profile from a resume (PDF or text)"

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  const stored = document.createElement("p")
  stored.className = "stored-resume"
  stored.textContent = storedLine(form.getCarried()?.resume?.name, true)

  const findings = document.createElement("div")
  findings.className = "findings"

  input.addEventListener("change", async () => {
    const file = input.files?.[0]
    if (!file) return

    status.textContent = READING_MESSAGE
    findings.replaceChildren()

    try {
      const outcome = await importFile(file, form.getValues(), form.getCarried())

      if (outcome.status === "saved") {
        form.showProfile(outcome.profile)
        status.textContent = SAVED_MESSAGE
        stored.textContent = storedLine(outcome.profile.resume?.name, true)
        showFindings(findings, outcome.warnings, outcome.profile.experience, outcome.profile.education)
      } else {
        form.showDraft(outcome.values, outcome.carried, outcome.errors)
        status.textContent = REVIEW_MESSAGE
        stored.textContent = storedLine(outcome.carried.resume?.name, false)
        showFindings(findings, outcome.warnings, outcome.carried.experience, outcome.carried.education)
      }
    } catch (error: unknown) {
      status.textContent = error instanceof Error ? error.message : "Something went wrong"
    } finally {
      input.value = ""
    }
  })

  const field = document.createElement("div")
  field.className = "field"
  field.append(label, input)
  container.append(field, stored, status, findings)
}

// Tests the resume upload panel: it reports progress, shows what was found, and hands results to the profile form.
// @vitest-environment jsdom
import type { CarriedOver, Profile } from "@auto-applier/core"
import { emptyFormValues } from "@auto-applier/core"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { FileImportOutcome } from "../resume/importResumeFile"
import type { ProfileFormHandle } from "./ProfileForm"
import { mountResumePanel } from "./ResumePanel"

const PROFILE: Profile = {
  personal: { firstName: "Pranav", lastName: "P", email: "p@example.com", phone: "555", links: {} },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "" }],
  education: [{ school: "State U", degree: "BSc", field: "Computer Science", startDate: "2018", endDate: "2022" }],
  skills: [],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
}

const CARRIED: CarriedOver = { experience: PROFILE.experience, education: PROFILE.education }

// Builds a stand-in for the profile form handle whose methods can be watched.
function fakeForm() {
  return {
    getValues: vi.fn(() => emptyFormValues()),
    getCarried: vi.fn(() => undefined as CarriedOver | undefined),
    showProfile: vi.fn(),
    showDraft: vi.fn(),
  } satisfies ProfileFormHandle
}

// Mounts the panel into a fresh page with the given form and import function.
function mountPanel(importFile: (file: File) => Promise<FileImportOutcome>, form = fakeForm()) {
  document.body.innerHTML = '<div id="root"></div>'
  const container = document.getElementById("root")!
  mountResumePanel(container, { form, importFile })
  return { container, form }
}

// Simulates choosing a file in the file input.
function chooseFile(file: File): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, "files", { value: [file], configurable: true })
  input.dispatchEvent(new Event("change", { bubbles: true }))
  return input
}

// Returns the text of the status line.
function status(): string {
  return document.querySelector('[role="status"]')?.textContent ?? ""
}

const FILE = new File(["%PDF"], "resume.pdf", { type: "application/pdf" })

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("ResumePanel", () => {
  test("accepts PDF and text files", () => {
    mountPanel(async () => ({ status: "saved", profile: PROFILE, warnings: [] }))

    const accept = document.querySelector<HTMLInputElement>('input[type="file"]')!.accept
    expect(accept).toContain(".pdf")
    expect(accept).toContain(".txt")
  })

  test("hands the chosen file, the form's values and what it carries to the import", async () => {
    const importFile = vi.fn(async (_file: File, _values: unknown, _carried: unknown): Promise<FileImportOutcome> => ({
      status: "saved",
      profile: PROFILE,
      warnings: [],
    }))
    const form = fakeForm()
    form.getCarried.mockReturnValue(CARRIED)
    const { container } = mountPanel(importFile as never, form)

    chooseFile(FILE)
    await vi.waitFor(() => expect(importFile).toHaveBeenCalled())

    expect(importFile).toHaveBeenCalledWith(FILE, emptyFormValues(), CARRIED)
    expect(container.textContent).toBeDefined()
  })

  test("says it is reading while the import runs", async () => {
    let finish: (outcome: FileImportOutcome) => void = () => undefined
    mountPanel(() => new Promise<FileImportOutcome>((resolve) => (finish = resolve)))

    chooseFile(FILE)

    await vi.waitFor(() => expect(status()).toBe("Reading your resume…"))
    finish({ status: "saved", profile: PROFILE, warnings: [] })
  })
})

describe("ResumePanel: which resume is stored", () => {
  const POINTER = { name: "my-resume.pdf", mimeType: "application/pdf", storageKey: "resume" }

  // Returns the text of the line that names the stored resume.
  function storedLine(): string {
    return document.querySelector(".stored-resume")?.textContent ?? ""
  }

  test("says no resume is stored yet when the profile has none", () => {
    mountPanel(async () => ({ status: "saved", profile: PROFILE, warnings: [] }))

    expect(storedLine()).toBe("No resume stored yet.")
  })

  test("names the resume the saved profile points to when it opens", () => {
    const form = fakeForm()
    form.getCarried.mockReturnValue({ ...CARRIED, resume: POINTER })
    mountPanel(async () => ({ status: "saved", profile: PROFILE, warnings: [] }), form)

    expect(storedLine()).toBe("Stored resume: my-resume.pdf")
  })

  test("names the resume right after a saved import", async () => {
    mountPanel(async () => ({ status: "saved", profile: { ...PROFILE, resume: POINTER }, warnings: [] }))

    chooseFile(FILE)
    await vi.waitFor(() => expect(storedLine()).toBe("Stored resume: my-resume.pdf"))
  })

  test("says the resume still needs Save profile when the import needs review", async () => {
    mountPanel(async () => ({
      status: "needs-review",
      values: emptyFormValues(),
      carried: { ...CARRIED, resume: POINTER },
      errors: ["answers.workAuthorization: Required"],
      warnings: [],
    }))

    chooseFile(FILE)
    await vi.waitFor(() => expect(storedLine()).toBe("Stored resume: my-resume.pdf (press Save profile to keep it linked)"))
  })

  test("keeps the earlier line when the import fails, and says so in the status", async () => {
    const form = fakeForm()
    form.getCarried.mockReturnValue({ ...CARRIED, resume: POINTER })
    mountPanel(async () => {
      throw new Error("Gemini returned 503")
    }, form)

    chooseFile(FILE)
    await vi.waitFor(() => expect(status()).toBe("Gemini returned 503"))

    expect(storedLine()).toBe("Stored resume: my-resume.pdf")
  })
})

describe("ResumePanel: a saved profile", () => {
  test("shows the saved profile in the form and says it was saved", async () => {
    const { form } = mountPanel(async () => ({ status: "saved", profile: PROFILE, warnings: [] }))

    chooseFile(FILE)
    await vi.waitFor(() => expect(status()).toContain("profile was saved"))

    expect(form.showProfile).toHaveBeenCalledWith(PROFILE)
    expect(form.showDraft).not.toHaveBeenCalled()
  })

  test("lists the warnings and what was found in the resume", async () => {
    const { container } = mountPanel(async () => ({
      status: "saved",
      profile: PROFILE,
      warnings: ["Skipped education #2: missing degree."],
    }))

    chooseFile(FILE)
    await vi.waitFor(() => expect(status()).toContain("profile was saved"))

    expect(container.textContent).toContain("Skipped education #2: missing degree.")
    expect(container.textContent).toContain("Engineer at Acme (2022 – Present)")
    expect(container.textContent).toContain("BSc in Computer Science, State U (2018 – 2022)")
  })
})

describe("ResumePanel: a profile that needs review", () => {
  const REVIEW: FileImportOutcome = {
    status: "needs-review",
    values: { ...emptyFormValues(), firstName: "Pranav" },
    carried: CARRIED,
    errors: ["answers.workAuthorization: Too small"],
    warnings: ["The resume is very long, so only the first 50000 characters were read."],
  }

  test("fills the form with the draft and the errors, without saving", async () => {
    const { form } = mountPanel(async () => REVIEW)

    chooseFile(FILE)
    await vi.waitFor(() => expect(status()).toContain("not complete yet"))

    expect(form.showDraft).toHaveBeenCalledWith(REVIEW.status === "needs-review" ? REVIEW.values : null, CARRIED, [
      "answers.workAuthorization: Too small",
    ])
    expect(form.showProfile).not.toHaveBeenCalled()
  })

  test("lists the warnings and what was found in the resume", async () => {
    const { container } = mountPanel(async () => REVIEW)

    chooseFile(FILE)
    await vi.waitFor(() => expect(status()).toContain("not complete yet"))

    expect(container.textContent).toContain("only the first 50000 characters were read")
    expect(container.textContent).toContain("Engineer at Acme (2022 – Present)")
  })
})

describe("ResumePanel: failures and clean-up", () => {
  test("shows the error and leaves the form alone", async () => {
    const { form } = mountPanel(async () => Promise.reject(new Error("Could not read this PDF.")))

    chooseFile(FILE)
    await vi.waitFor(() => expect(status()).toBe("Could not read this PDF."))

    expect(form.showProfile).not.toHaveBeenCalled()
    expect(form.showDraft).not.toHaveBeenCalled()
  })

  test("clears the file choice afterwards so the same file can be chosen again", async () => {
    mountPanel(async () => ({ status: "saved", profile: PROFILE, warnings: [] }))
    const input = chooseFile(FILE)
    const clear = vi.spyOn(input, "value", "set")

    await vi.waitFor(() => expect(status()).toContain("profile was saved"))

    expect(clear).toHaveBeenCalledWith("")
  })

  test("clears the previous warnings and findings when another file is chosen", async () => {
    let call = 0
    const { container } = mountPanel(async () => {
      call += 1
      return call === 1
        ? { status: "saved", profile: PROFILE, warnings: ["First warning"] }
        : { status: "saved", profile: { ...PROFILE, experience: [], education: [] }, warnings: [] }
    })

    chooseFile(FILE)
    await vi.waitFor(() => expect(container.textContent).toContain("First warning"))
    chooseFile(FILE)
    await vi.waitFor(() => expect(container.textContent).not.toContain("First warning"))

    expect(container.textContent).not.toContain("Engineer at Acme")
  })
})

// Tests that an uploaded resume file is read, stored and either saved as the profile or returned for review.
import type { LLMClient, Profile, ProfileStore, ResumeStore, StoredResume } from "@auto-applier/core"
import { emptyFormValues } from "@auto-applier/core"
import { describe, expect, test, vi } from "vitest"
import { importResumeFile, RESUME_KEY } from "./importResumeFile"

const ANSWER = {
  firstName: "Pranav",
  lastName: "Pattanashetty",
  email: "pranav@example.com",
  phone: "5551234567",
  skills: ["TypeScript"],
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", endDate: "", description: "Built things" }],
  education: [],
}

const ANSWERED = { ...emptyFormValues(), workAuthorization: "Citizen" }

// Builds an in-memory resume store that remembers what was saved.
function memoryResumes(initial?: StoredResume): ResumeStore & { saved: Map<string, StoredResume> } {
  const saved = new Map<string, StoredResume>(initial ? [[RESUME_KEY, initial]] : [])
  return {
    saved,
    save: async (key, resume) => {
      saved.set(key, resume)
    },
    load: async (key) => saved.get(key),
  }
}

// Builds an in-memory profile store that remembers every profile saved.
function memoryProfiles(): ProfileStore & { saved: Profile[] } {
  const saved: Profile[] = []
  return {
    saved,
    load: async () => saved[saved.length - 1],
    save: async (profile) => {
      saved.push(profile)
    },
  }
}

// Builds the helpers the import needs, with a model that answers as given.
function setup(answer: unknown = ANSWER) {
  const llm: LLMClient = { completeJson: vi.fn(async () => answer) }
  const resumes = memoryResumes()
  const profiles = memoryProfiles()
  const readPdf = vi.fn(async () => "resume text from the pdf")
  return { deps: { readPdf, llm, resumes, profiles }, llm, resumes, profiles, readPdf }
}

const pdfFile = () => new File([new Uint8Array([1, 2, 3])], "resume.pdf", { type: "application/pdf" })

describe("importResumeFile: a complete profile", () => {
  test("saves the profile with a pointer to the stored resume", async () => {
    const { deps, profiles } = setup()

    const outcome = await importResumeFile(pdfFile(), ANSWERED, undefined, deps)

    expect(outcome.status).toBe("saved")
    expect(profiles.saved).toHaveLength(1)
    expect(profiles.saved[0]?.personal.firstName).toBe("Pranav")
    expect(profiles.saved[0]?.resume).toEqual({ name: "resume.pdf", mimeType: "application/pdf", storageKey: RESUME_KEY })
  })

  test("stores the original file bytes", async () => {
    const { deps, resumes } = setup()

    await importResumeFile(pdfFile(), ANSWERED, undefined, deps)

    const stored = resumes.saved.get(RESUME_KEY)
    expect(stored?.name).toBe("resume.pdf")
    expect(stored?.mimeType).toBe("application/pdf")
    expect(new Uint8Array(stored!.data)).toEqual(new Uint8Array([1, 2, 3]))
  })

  test("returns the saved profile and any warnings", async () => {
    const answer = {
      ...ANSWER,
      experience: [{ company: "Acme", title: "", startDate: "2022", endDate: "", description: "" }],
    }
    const { deps } = setup(answer)

    const outcome = await importResumeFile(pdfFile(), ANSWERED, undefined, deps)

    expect(outcome.status === "saved" && outcome.warnings).toEqual(["Skipped work experience #1: missing title."])
  })

  test("sends the text from the PDF reader to the model", async () => {
    const { deps, llm, readPdf } = setup()

    await importResumeFile(pdfFile(), ANSWERED, undefined, deps)

    expect(readPdf).toHaveBeenCalledTimes(1)
    expect(llm.completeJson).toHaveBeenCalledWith(expect.stringContaining("resume text from the pdf"))
  })

  test("reads a plain text file without the PDF reader", async () => {
    const { deps, readPdf, llm } = setup()
    const file = new File(["Pranav, Software Engineer"], "resume.txt", { type: "text/plain" })

    await importResumeFile(file, ANSWERED, undefined, deps)

    expect(readPdf).not.toHaveBeenCalled()
    expect(llm.completeJson).toHaveBeenCalledWith(expect.stringContaining("Pranav, Software Engineer"))
  })

  test("works out the type from the name when the browser gives none", async () => {
    const { deps, profiles } = setup()

    await importResumeFile(new File(["%PDF"], "cv.pdf", { type: "" }), ANSWERED, undefined, deps)
    await importResumeFile(new File(["notes"], "cv.txt", { type: "" }), ANSWERED, undefined, deps)

    expect(profiles.saved.map((profile) => profile.resume?.mimeType)).toEqual(["application/pdf", "text/plain"])
  })

  test("keeps the previous jobs when the resume has none", async () => {
    const { deps, profiles } = setup({ ...ANSWER, experience: [] })
    const previous = {
      experience: [{ company: "Old Co", title: "Dev", startDate: "2015", description: "" }],
      education: [],
      resume: { name: "old.pdf", mimeType: "application/pdf", storageKey: RESUME_KEY },
    }

    await importResumeFile(pdfFile(), ANSWERED, previous, deps)

    expect(profiles.saved[0]?.experience).toEqual(previous.experience)
    expect(profiles.saved[0]?.resume?.name).toBe("resume.pdf")
  })
})

describe("importResumeFile: a profile that needs review", () => {
  test("does not save the profile, but returns the filled form and what to carry", async () => {
    const { deps, profiles } = setup()

    const outcome = await importResumeFile(pdfFile(), emptyFormValues(), undefined, deps)

    expect(profiles.saved).toEqual([])
    expect(outcome.status).toBe("needs-review")
    if (outcome.status === "needs-review") {
      expect(outcome.values.firstName).toBe("Pranav")
      expect(outcome.errors.join(" ")).toContain("answers.workAuthorization")
      expect(outcome.carried.experience.map((job) => job.company)).toEqual(["Acme"])
      expect(outcome.carried.resume).toEqual({ name: "resume.pdf", mimeType: "application/pdf", storageKey: RESUME_KEY })
    }
  })

  test("still stores the resume file", async () => {
    const { deps, resumes } = setup()

    await importResumeFile(pdfFile(), emptyFormValues(), undefined, deps)

    expect(resumes.saved.get(RESUME_KEY)?.name).toBe("resume.pdf")
  })
})

describe("importResumeFile: failures leave everything as it was", () => {
  const OLD_RESUME: StoredResume = { name: "old.pdf", mimeType: "application/pdf", data: new ArrayBuffer(1) }

  test("a model failure stores and saves nothing", async () => {
    const llm: LLMClient = {
      completeJson: async () => {
        throw new Error("Gemini returned 429: Resource exhausted")
      },
    }
    const resumes = memoryResumes(OLD_RESUME)
    const profiles = memoryProfiles()

    await expect(
      importResumeFile(pdfFile(), ANSWERED, undefined, { readPdf: async () => "text", llm, resumes, profiles }),
    ).rejects.toThrow("Gemini returned 429")

    expect(resumes.saved.get(RESUME_KEY)).toBe(OLD_RESUME)
    expect(profiles.saved).toEqual([])
  })

  test("an unsupported file type stores and saves nothing", async () => {
    const { deps, resumes, profiles, llm } = setup()
    const docx = new File(["x"], "resume.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })

    await expect(importResumeFile(docx, ANSWERED, undefined, deps)).rejects.toThrow("Only PDF and plain text")

    expect(resumes.saved.size).toBe(0)
    expect(profiles.saved).toEqual([])
    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("an unreadable PDF stores and saves nothing", async () => {
    const { deps, resumes, profiles } = setup()
    const failing = { ...deps, readPdf: async () => Promise.reject(new Error("Could not read this PDF.")) }

    await expect(importResumeFile(pdfFile(), ANSWERED, undefined, failing)).rejects.toThrow("Could not read this PDF.")

    expect(resumes.saved.size).toBe(0)
    expect(profiles.saved).toEqual([])
  })

  test("a failure to save the profile is reported", async () => {
    const { deps } = setup()
    const failingProfiles: ProfileStore = {
      load: async () => undefined,
      save: async () => Promise.reject(new Error("storage is full")),
    }

    await expect(importResumeFile(pdfFile(), ANSWERED, undefined, { ...deps, profiles: failingProfiles })).rejects.toThrow(
      "storage is full",
    )
  })
})

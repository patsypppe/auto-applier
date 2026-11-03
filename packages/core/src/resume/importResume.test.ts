// Tests that importResume reads a resume and decides between a ready profile and one that needs the user's review.
import { describe, expect, test, vi } from "vitest"
import type { LLMClient } from "../ports/LLMClient"
import { emptyFormValues } from "../profile/formValues"
import type { CarriedOver, ProfileFormValues } from "../profile/formValues"
import { importResume } from "./importResume"

const ANSWER = {
  firstName: "Pranav",
  lastName: "Pattanashetty",
  email: "pranav@example.com",
  phone: "5551234567",
  skills: ["TypeScript"],
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", endDate: "", description: "Built things" }],
  education: [],
}

const ANSWERED: ProfileFormValues = { ...emptyFormValues(), workAuthorization: "Citizen" }

const PREVIOUS: CarriedOver = {
  experience: [{ company: "Old Co", title: "Dev", startDate: "2015", description: "" }],
  education: [{ school: "Old U", degree: "BA", startDate: "2010" }],
  resume: { name: "old.pdf", mimeType: "application/pdf", storageKey: "resume" },
}

// Builds a model stand-in that always answers with the given value.
function modelAnswering(answer: unknown): LLMClient {
  return { completeJson: vi.fn(async () => answer) }
}

describe("importResume: a complete result", () => {
  test("is ready when the form already holds the required answers", async () => {
    const outcome = await importResume("resume text", modelAnswering(ANSWER), ANSWERED)

    expect(outcome.status).toBe("ready")
    if (outcome.status === "ready") {
      expect(outcome.profile.personal.firstName).toBe("Pranav")
      expect(outcome.profile.answers.workAuthorization).toBe("Citizen")
      expect(outcome.profile.experience.map((job) => job.company)).toEqual(["Acme"])
      expect(outcome.draft.skills).toEqual(["TypeScript"])
      expect(outcome.warnings).toEqual([])
    }
  })

  test("keeps the previous resume file and, when the resume has none, the previous jobs and degrees", async () => {
    const answer = { ...ANSWER, experience: [] }

    const outcome = await importResume("resume text", modelAnswering(answer), ANSWERED, PREVIOUS)

    expect(outcome.status).toBe("ready")
    if (outcome.status === "ready") {
      expect(outcome.profile.resume).toEqual(PREVIOUS.resume)
      expect(outcome.profile.experience).toEqual(PREVIOUS.experience)
      expect(outcome.profile.education).toEqual(PREVIOUS.education)
    }
  })

  test("passes on the warnings about anything dropped", async () => {
    const answer = {
      ...ANSWER,
      experience: [{ company: "Acme", title: "", startDate: "2022", endDate: "", description: "" }],
    }

    const outcome = await importResume("resume text", modelAnswering(answer), ANSWERED)

    expect(outcome.warnings).toEqual(["Skipped work experience #1: missing title."])
  })
})

describe("importResume: a result that needs review", () => {
  test("needs review when something required is missing, such as work authorization", async () => {
    const outcome = await importResume("resume text", modelAnswering(ANSWER), emptyFormValues())

    expect(outcome.status).toBe("needs-review")
    if (outcome.status === "needs-review") {
      expect(outcome.errors.join(" ")).toContain("answers.workAuthorization")
    }
  })

  test("hands back the form values filled from the resume", async () => {
    const outcome = await importResume("resume text", modelAnswering(ANSWER), emptyFormValues())

    expect(outcome.status === "needs-review" && outcome.values).toMatchObject({
      firstName: "Pranav",
      lastName: "Pattanashetty",
      email: "pranav@example.com",
      skills: "TypeScript",
    })
  })

  test("hands back what to carry over: the resume's jobs plus the previous resume file", async () => {
    const outcome = await importResume("resume text", modelAnswering(ANSWER), emptyFormValues(), PREVIOUS)

    expect(outcome.status === "needs-review" && outcome.carried.experience.map((job) => job.company)).toEqual(["Acme"])
    expect(outcome.status === "needs-review" && outcome.carried.education).toEqual(PREVIOUS.education)
    expect(outcome.status === "needs-review" && outcome.carried.resume).toEqual(PREVIOUS.resume)
  })
})

describe("importResume: failures", () => {
  test("passes on the model's error", async () => {
    const model: LLMClient = {
      completeJson: async () => {
        throw new Error("Gemini returned 429: Resource exhausted")
      },
    }

    await expect(importResume("resume text", model, ANSWERED)).rejects.toThrow("Gemini returned 429")
  })

  test("rejects an answer that is not a resume", async () => {
    await expect(importResume("resume text", modelAnswering([1, 2]), ANSWERED)).rejects.toThrow(
      "did not look like a resume",
    )
  })

  test("rejects text with nothing in it without calling the model", async () => {
    const model = modelAnswering(ANSWER)

    await expect(importResume("  ", model, ANSWERED)).rejects.toThrow("The resume has no text to read")
    expect(model.completeJson).not.toHaveBeenCalled()
  })
})

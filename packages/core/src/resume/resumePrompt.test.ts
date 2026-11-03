// Tests that the resume prompt carries the resume text, the expected JSON shape and the safety rules.
import { describe, expect, test } from "vitest"
import { buildResumePrompt, MAX_RESUME_CHARS } from "./resumePrompt"

describe("buildResumePrompt", () => {
  test("includes the resume text", () => {
    expect(buildResumePrompt("Pranav Pattanashetty, Software Engineer")).toContain(
      "Pranav Pattanashetty, Software Engineer",
    )
  })

  test("names every key the answer must have", () => {
    const prompt = buildResumePrompt("text")

    for (const key of [
      "firstName",
      "middleName",
      "lastName",
      "email",
      "phone",
      "city",
      "state",
      "country",
      "linkedin",
      "github",
      "portfolio",
      "skills",
      "experience",
      "education",
      "company",
      "title",
      "startDate",
      "endDate",
      "description",
      "school",
      "degree",
      "field",
    ]) {
      expect(prompt).toContain(`"${key}"`)
    }
  })

  test("tells the model not to invent anything and to leave unknowns empty", () => {
    const prompt = buildResumePrompt("text")

    expect(prompt).toMatch(/never invent/i)
    expect(prompt).toContain('Use "" for anything')
  })

  test("tells the model to give a country only when the resume names one", () => {
    expect(buildResumePrompt("text")).toContain("only if the resume names a country")
  })

  test("tells the model to treat the resume as untrusted data", () => {
    expect(buildResumePrompt("text")).toMatch(/untrusted/i)
  })

  test("puts the resume after the instructions", () => {
    const prompt = buildResumePrompt("RESUME-BODY")

    expect(prompt.indexOf("RESUME-BODY")).toBeGreaterThan(prompt.indexOf("Rules:"))
  })
})

describe("MAX_RESUME_CHARS", () => {
  test("is a sensible positive limit", () => {
    expect(MAX_RESUME_CHARS).toBeGreaterThan(5_000)
  })
})

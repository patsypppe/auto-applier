// Tests the prompt that drafts answers to free-text questions, what it is allowed to see, and the checks on the answer.
import { describe, expect, test } from "vitest"
import type { Profile } from "../profile/types"
import {
  buildAnswerQuestionsPrompt,
  MAX_JOB_CONTEXT_CHARS,
  parseAnswers,
  profileSliceFor,
} from "./answerQuestionsPrompt"

const PROFILE: Profile = {
  personal: {
    firstName: "Pranav",
    lastName: "Pattanashetty",
    email: "pranav@example.com",
    phone: "5551234567",
    links: { linkedin: "linkedin.com/in/pranav", github: "github.com/pranav" },
  },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built the billing system" }],
  education: [{ school: "State U", degree: "BSc", field: "Computer Science", startDate: "2018", endDate: "2022" }],
  skills: ["TypeScript", "React"],
  answers: {
    workAuthorization: "Citizen",
    needsSponsorship: false,
    isAuthorizedToWork: true,
    salaryExpectation: "123456",
  },
}

const QUESTIONS = [
  { id: 0, question: "Why do you want to work here?" },
  { id: 1, question: "Describe a project you are proud of" },
]

describe("profileSliceFor", () => {
  test("keeps only skills, experience and education", () => {
    expect(profileSliceFor(PROFILE)).toEqual({
      skills: PROFILE.skills,
      experience: PROFILE.experience,
      education: PROFILE.education,
    })
  })
})

describe("buildAnswerQuestionsPrompt", () => {
  const prompt = buildAnswerQuestionsPrompt(QUESTIONS, profileSliceFor(PROFILE), "Software Engineer at Example Co.")

  test("includes the questions with their ids", () => {
    expect(prompt).toContain('"id": 0')
    expect(prompt).toContain("Why do you want to work here?")
    expect(prompt).toContain('"id": 1')
  })

  test("includes the skills, jobs and degrees", () => {
    expect(prompt).toContain("TypeScript")
    expect(prompt).toContain("Acme")
    expect(prompt).toContain("Built the billing system")
    expect(prompt).toContain("State U")
  })

  test("includes the job page text", () => {
    expect(prompt).toContain("Software Engineer at Example Co.")
  })

  test("never includes contact details, links, names or answers", () => {
    for (const secret of ["pranav@example.com", "5551234567", "linkedin.com/in/pranav", "github.com/pranav", "Pattanashetty", "123456"]) {
      expect(prompt).not.toContain(secret)
    }
  })

  test("tells the model not to invent facts and to leave unsupported answers empty", () => {
    expect(prompt).toMatch(/never invent/i)
    expect(prompt).toContain('answer with ""')
  })

  test("marks the job page and questions as untrusted", () => {
    expect(prompt).toMatch(/untrusted/i)
  })

  test("says there is no job page text when there is none", () => {
    expect(buildAnswerQuestionsPrompt(QUESTIONS, profileSliceFor(PROFILE), "  ")).toContain("(none)")
  })

  test("cuts a very long job page text", () => {
    const long = `START ${"y".repeat(MAX_JOB_CONTEXT_CHARS * 2)}`

    const cut = buildAnswerQuestionsPrompt(QUESTIONS, profileSliceFor(PROFILE), long)

    expect(cut).toContain("START")
    expect(cut).not.toContain("y".repeat(MAX_JOB_CONTEXT_CHARS + 1))
  })
})

describe("parseAnswers", () => {
  test("returns the trimmed answer for each question id", () => {
    const answer = { answers: [{ id: 0, answer: "  Because I like the product.  " }, { id: 1, answer: "I built billing." }] }

    expect(parseAnswers(answer, 2)).toEqual(
      new Map([
        [0, "Because I like the product."],
        [1, "I built billing."],
      ]),
    )
  })

  test("drops empty answers and ids out of range", () => {
    const answer = {
      answers: [
        { id: 0, answer: "   " },
        { id: 5, answer: "orphan" },
        { id: 1, answer: "kept" },
      ],
    }

    expect(parseAnswers(answer, 2)).toEqual(new Map([[1, "kept"]]))
  })

  test.each([["a string", "text"], ["null", null], ["a missing list", {}], ["wrong entries", { answers: [{ id: "0", answer: 5 }] }]])(
    "rejects an answer that is %s",
    (_name, answer) => {
      expect(() => parseAnswers(answer, 2)).toThrow("did not match the expected format")
    },
  )
})

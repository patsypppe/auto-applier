// Tests that the one prompt for everything the rules left carries the whole profile and the fields, sets the safety rules, and checks each answer.
import { describe, expect, test } from "vitest"
import type { Profile } from "../profile/types"
import { buildAnswerFieldsPrompt, MAX_JOB_CONTEXT_CHARS, parseFieldAnswers, profileForPrompt } from "./answerFieldsPrompt"
import type { FieldToAnswer } from "./answerFieldsPrompt"
import { FORMAT_ERROR } from "./formatError"

const PROFILE: Profile = {
  personal: { firstName: "Pranav", lastName: "P", email: "pranav@example.com", phone: "5551234567", city: "Seattle", links: {} },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built the billing system" }],
  education: [{ school: "State U", degree: "BSc", startDate: "2018" }],
  skills: ["TypeScript"],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true, salaryExpectation: "123456" },
  notes: "Male. Asian (South Asian). Not a veteran.",
  resume: { name: "resume.pdf", mimeType: "application/pdf", storageKey: "resume" },
}

const item = (overrides: Partial<FieldToAnswer> = {}): FieldToAnswer => ({
  id: 0,
  question: "Gender",
  kind: "select",
  options: ["Male", "Female", "Decline to self-identify"],
  longAnswer: false,
  ...overrides,
})

describe("profileForPrompt", () => {
  test("keeps every fact in the profile and drops only the resume file pointer", () => {
    const shown = profileForPrompt(PROFILE)

    expect(shown).toMatchObject({ personal: PROFILE.personal, skills: ["TypeScript"], notes: PROFILE.notes })
    expect(shown.answers.salaryExpectation).toBe("123456")
    expect(shown).not.toHaveProperty("resume")
  })

  test("cuts very long job descriptions so one profile cannot swamp the prompt", () => {
    const long = { ...PROFILE, experience: [{ ...PROFILE.experience[0]!, description: "x".repeat(5000) }] }

    expect(profileForPrompt(long).experience[0]?.description.length).toBeLessThanOrEqual(500)
  })
})

describe("buildAnswerFieldsPrompt", () => {
  test("includes the applicant's whole profile, including notes and contact details", () => {
    const prompt = buildAnswerFieldsPrompt([item()], PROFILE, "")

    for (const fact of ["pranav@example.com", "5551234567", "123456", "Asian (South Asian)", "Built the billing system", "State U"]) {
      expect(prompt).toContain(fact)
    }
    expect(prompt).not.toContain("storageKey")
  })

  test("sets the safety rules: untrusted text, nothing invented, exact options, equal-opportunity handling", () => {
    const prompt = buildAnswerFieldsPrompt([item()], PROFILE, "")

    expect(prompt).toMatch(/untrusted/i)
    expect(prompt).toMatch(/never invent/i)
    expect(prompt).toMatch(/copied exactly/i)
    expect(prompt).toMatch(/equal-opportunity/i)
    expect(prompt).toMatch(/decline/i)
  })

  test("lists each field with its id, question, kind and options", () => {
    const prompt = buildAnswerFieldsPrompt([item(), item({ id: 1, question: "School", kind: "combobox", options: [] })], PROFILE, "")

    expect(prompt).toContain('"question": "Gender"')
    expect(prompt).toContain('"id": 1')
    expect(prompt).toContain('"kind": "combobox"')
    expect(prompt).toContain("Decline to self-identify")
  })

  test("limits how many options are sent and how long each is", () => {
    const options = Array.from({ length: 200 }, (_unused, index) => `Option ${index} ${"y".repeat(300)}`)

    const prompt = buildAnswerFieldsPrompt([item({ options })], PROFILE, "")

    expect(prompt).toContain("Option 59")
    expect(prompt).not.toContain("Option 60 ")
    expect(prompt).not.toContain("y".repeat(150))
  })

  test("marks written questions so the model drafts a paragraph", () => {
    const prompt = buildAnswerFieldsPrompt([item({ question: "Why us?", kind: "text", options: [], longAnswer: true })], PROFILE, "")

    expect(prompt).toContain('"longAnswer": true')
    expect(prompt).toMatch(/60 to 120 words/)
  })

  test("includes the job page text, cut to the limit, only when a written answer is asked for", () => {
    const written = item({ kind: "text", options: [], longAnswer: true })

    const withJob = buildAnswerFieldsPrompt([written], PROFILE, "z".repeat(MAX_JOB_CONTEXT_CHARS + 500))
    const withoutWriting = buildAnswerFieldsPrompt([item()], PROFILE, "Billing company hiring engineers")

    expect(withJob).toContain("z".repeat(MAX_JOB_CONTEXT_CHARS))
    expect(withJob).not.toContain("z".repeat(MAX_JOB_CONTEXT_CHARS + 1))
    expect(withoutWriting).not.toContain("Billing company hiring engineers")
  })

  test("says there is no job text when a written answer is asked for but none was found", () => {
    const prompt = buildAnswerFieldsPrompt([item({ kind: "text", options: [], longAnswer: true })], PROFILE, "  ")

    expect(prompt).toContain("(none)")
  })
})

describe("parseFieldAnswers", () => {
  const SELECT = item()
  const TEXT = item({ id: 1, question: "School", kind: "combobox", options: [] })

  test("reads answers by field id, trimmed", () => {
    const answers = parseFieldAnswers({ answers: [{ id: 0, answer: "Male" }, { id: 1, answer: "  State U " }] }, [SELECT, TEXT])

    expect(answers).toEqual(new Map([[0, "Male"], [1, "State U"]]))
  })

  test("gives the exact option text for a choice, whatever the case or spacing the model used", () => {
    const answers = parseFieldAnswers({ answers: [{ id: 0, answer: "  decline  to SELF-identify " }] }, [SELECT])

    expect(answers.get(0)).toBe("Decline to self-identify")
  })

  test("drops a choice answer that is not one of the options", () => {
    expect(parseFieldAnswers({ answers: [{ id: 0, answer: "Non-binary" }] }, [SELECT]).size).toBe(0)
  })

  test.each(["select", "radio", "checkbox-group"] as const)("checks the options of a %s field", (kind) => {
    const field = item({ kind, options: ["Yes", "No"] })

    expect(parseFieldAnswers({ answers: [{ id: 0, answer: "Maybe" }] }, [field]).size).toBe(0)
    expect(parseFieldAnswers({ answers: [{ id: 0, answer: "no" }] }, [field]).get(0)).toBe("No")
  })

  test("accepts any text for a text or search-as-you-type field", () => {
    const answers = parseFieldAnswers({ answers: [{ id: 0, answer: "Seattle, WA" }] }, [item({ kind: "text", options: [] })])

    expect(answers.get(0)).toBe("Seattle, WA")
  })

  test("ignores blank, missing and null answers, unknown ids and repeated ids", () => {
    const answers = parseFieldAnswers(
      { answers: [{ id: 0, answer: "   " }, { id: 1, answer: null }, { id: 7, answer: "x" }, { id: 1, answer: "A" }, { id: 1, answer: "B" }] },
      [SELECT, TEXT],
    )

    expect(answers).toEqual(new Map([[1, "A"]]))
  })

  test("cuts an answer that is far too long", () => {
    const answers = parseFieldAnswers({ answers: [{ id: 0, answer: "w".repeat(5000) }] }, [item({ kind: "text", options: [] })])

    expect(answers.get(0)?.length).toBeLessThanOrEqual(2000)
  })

  test.each([[null], [{}], [{ answers: "x" }], [{ answers: [{ id: "0", answer: "x" }] }], ["text"]])(
    "throws the format error for %j",
    (bad) => {
      expect(() => parseFieldAnswers(bad, [SELECT])).toThrow(FORMAT_ERROR)
    },
  )
})

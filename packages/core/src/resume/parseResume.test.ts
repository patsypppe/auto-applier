// Tests that parseResume turns the model's answer into a clean draft, and refuses answers it cannot trust.
import { describe, expect, test, vi } from "vitest"
import type { LLMClient } from "../ports/LLMClient"
import { parseResume } from "./parseResume"
import { MAX_RESUME_CHARS } from "./resumePrompt"

const FULL_ANSWER = {
  firstName: "Pranav",
  middleName: "",
  lastName: "Pattanashetty",
  email: "pranav@example.com",
  phone: "5551234567",
  city: "Seattle",
  state: "WA",
  country: "",
  linkedin: "linkedin.com/in/pranav",
  github: "github.com/pranav",
  portfolio: "",
  skills: ["TypeScript", "React"],
  experience: [
    { company: "Acme", title: "Engineer", startDate: "Jan 2022", endDate: "", description: "Built things" },
  ],
  education: [{ school: "State U", degree: "BSc", field: "Computer Science", startDate: "2018", endDate: "2022" }],
}

// Builds a model stand-in that always answers with the given value.
function modelAnswering(answer: unknown): LLMClient {
  return { completeJson: vi.fn(async () => answer) }
}

describe("parseResume: location", () => {
  test("keeps the city, state and country the model found, trimmed", async () => {
    const answer = { ...FULL_ANSWER, city: "  Austin ", state: " TX", country: "United States " }

    const { draft } = await parseResume("resume text", modelAnswering(answer))

    expect(draft.personal).toMatchObject({ city: "Austin", state: "TX", country: "United States" })
  })

  test("treats a missing or null location as blank", async () => {
    const { city, state, country, ...withoutLocation } = FULL_ANSWER
    const answer = { ...withoutLocation, state: null }

    const { draft } = await parseResume("resume text", modelAnswering(answer))

    expect([draft.personal.city, draft.personal.state, draft.personal.country]).toEqual(["", "", ""])
  })
})

describe("parseResume: reading a good answer", () => {
  test("turns the answer into a draft", async () => {
    const { draft, warnings } = await parseResume("resume text", modelAnswering(FULL_ANSWER))

    expect(draft).toEqual({
      personal: {
        firstName: "Pranav",
        middleName: "",
        lastName: "Pattanashetty",
        email: "pranav@example.com",
        phone: "5551234567",
        city: "Seattle",
        state: "WA",
        country: "",
        links: { linkedin: "linkedin.com/in/pranav", github: "github.com/pranav" },
      },
      experience: [{ company: "Acme", title: "Engineer", startDate: "Jan 2022", description: "Built things" }],
      education: [
        { school: "State U", degree: "BSc", field: "Computer Science", startDate: "2018", endDate: "2022" },
      ],
      skills: ["TypeScript", "React"],
    })
    expect(warnings).toEqual([])
  })

  test("sends the resume text to the model", async () => {
    const model = modelAnswering(FULL_ANSWER)

    await parseResume("Pranav the engineer", model)

    expect(model.completeJson).toHaveBeenCalledWith(expect.stringContaining("Pranav the engineer"))
  })

  test("trims whitespace and leaves out blank optional values", async () => {
    const answer = { ...FULL_ANSWER, firstName: "  Pranav  ", linkedin: "   ", github: "" }

    const { draft } = await parseResume("text", modelAnswering(answer))

    expect(draft.personal.firstName).toBe("Pranav")
    expect(draft.personal.links).toEqual({})
  })

  test("treats missing sections and fields as empty", async () => {
    const { draft } = await parseResume("text", modelAnswering({ firstName: "Pranav" }))

    expect(draft.personal).toEqual({
      firstName: "Pranav",
      middleName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      country: "",
      links: {},
    })
    expect(draft.experience).toEqual([])
    expect(draft.education).toEqual([])
    expect(draft.skills).toEqual([])
  })

  test("accepts null for values the model did not find", async () => {
    const answer = { ...FULL_ANSWER, middleName: null, portfolio: null, experience: null }

    const { draft } = await parseResume("text", modelAnswering(answer))

    expect(draft.personal.middleName).toBe("")
    expect(draft.experience).toEqual([])
  })

  test("ignores keys it does not know", async () => {
    const { draft } = await parseResume("text", modelAnswering({ ...FULL_ANSWER, favouriteColour: "blue" }))

    expect(draft).not.toHaveProperty("favouriteColour")
    expect(draft.personal).not.toHaveProperty("favouriteColour")
  })
})

describe("parseResume: skills", () => {
  test("drops empty skills and repeats, keeping the first spelling", async () => {
    const answer = { ...FULL_ANSWER, skills: [" TypeScript ", "", "typescript", "React", "REACT"] }

    expect((await parseResume("text", modelAnswering(answer))).draft.skills).toEqual(["TypeScript", "React"])
  })

  test("accepts skills given as one comma-separated string", async () => {
    const answer = { ...FULL_ANSWER, skills: "TypeScript, React,, Node" }

    expect((await parseResume("text", modelAnswering(answer))).draft.skills).toEqual(["TypeScript", "React", "Node"])
  })
})

describe("parseResume: jobs and degrees", () => {
  test("leaves out the end date for a current position", async () => {
    const answer = {
      ...FULL_ANSWER,
      experience: [
        { company: "A", title: "T", startDate: "2020", endDate: "Present", description: "" },
        { company: "B", title: "T", startDate: "2018", endDate: "current", description: "" },
        { company: "C", title: "T", startDate: "2016", endDate: "2018", description: "" },
      ],
    }

    const { draft } = await parseResume("text", modelAnswering(answer))

    expect(draft.experience.map((job) => job.endDate)).toEqual([undefined, undefined, "2018"])
  })

  test("uses the end date as the start date when only one date is given", async () => {
    const answer = {
      ...FULL_ANSWER,
      education: [{ school: "State U", degree: "BSc", field: "", startDate: "", endDate: "2022" }],
    }

    const { draft, warnings } = await parseResume("text", modelAnswering(answer))

    expect(draft.education).toEqual([{ school: "State U", degree: "BSc", startDate: "2022", endDate: "2022" }])
    expect(warnings).toEqual([])
  })

  test("drops a job that is missing required details and says why", async () => {
    const answer = {
      ...FULL_ANSWER,
      experience: [
        { company: "Acme", title: "", startDate: "2020", endDate: "", description: "" },
        { company: "Good Co", title: "Dev", startDate: "2019", endDate: "", description: "" },
        { company: "", title: "Dev", startDate: "", endDate: "", description: "" },
      ],
    }

    const { draft, warnings } = await parseResume("text", modelAnswering(answer))

    expect(draft.experience.map((job) => job.company)).toEqual(["Good Co"])
    expect(warnings).toEqual([
      "Skipped work experience #1: missing title.",
      "Skipped work experience #3: missing company, start date.",
    ])
  })

  test("drops a degree that is missing required details and says why", async () => {
    const answer = {
      ...FULL_ANSWER,
      education: [
        { school: "State U", degree: "", field: "", startDate: "2018", endDate: "2022" },
        { school: "", degree: "BSc", field: "", startDate: "", endDate: "" },
      ],
    }

    const { draft, warnings } = await parseResume("text", modelAnswering(answer))

    expect(draft.education).toEqual([])
    expect(warnings).toEqual([
      "Skipped education #1: missing degree.",
      "Skipped education #2: missing school, start date.",
    ])
  })
})

describe("parseResume: refusing what it cannot trust", () => {
  test("rejects a resume with no text without calling the model", async () => {
    const model = modelAnswering(FULL_ANSWER)

    await expect(parseResume("   \n ", model)).rejects.toThrow("The resume has no text to read")
    expect(model.completeJson).not.toHaveBeenCalled()
  })

  test.each([["a string", "I could not read that"], ["a list", [1, 2, 3]], ["null", null]])(
    "rejects an answer that is %s",
    async (_name, answer) => {
      await expect(parseResume("text", modelAnswering(answer))).rejects.toThrow("did not look like a resume")
    },
  )

  test("rejects an answer with values of the wrong type", async () => {
    await expect(parseResume("text", modelAnswering({ firstName: 42 }))).rejects.toThrow("did not look like a resume")
    await expect(parseResume("text", modelAnswering({ experience: "none" }))).rejects.toThrow(
      "did not look like a resume",
    )
  })

  test("passes on the model's own error", async () => {
    const model: LLMClient = {
      completeJson: async () => {
        throw new Error("Gemini returned 429: Resource exhausted")
      },
    }

    await expect(parseResume("text", model)).rejects.toThrow("Gemini returned 429: Resource exhausted")
  })
})

describe("parseResume: very long resumes", () => {
  test("sends only the first part of an enormous text and warns about it", async () => {
    const model = modelAnswering(FULL_ANSWER)

    const { warnings } = await parseResume("x".repeat(MAX_RESUME_CHARS + 500), model)

    const prompt = (model.completeJson as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(prompt).not.toContain("x".repeat(MAX_RESUME_CHARS + 1))
    expect(prompt).toContain("x".repeat(MAX_RESUME_CHARS))
    expect(warnings).toEqual([expect.stringContaining("long")])
  })
})

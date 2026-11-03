// Tests that a fill run checks the saved profile, uses the LLM for help, outlines fields, and always replies.
// @vitest-environment jsdom
import type { LLMClient, Profile, ProfileStore } from "@auto-applier/core"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { runFill } from "./runFill"

const PROFILE: Profile = {
  personal: { firstName: "Pranav", lastName: "Pattanashetty", email: "pranav@example.com", phone: "5551234567", links: {} },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built the billing system" }],
  education: [],
  skills: ["TypeScript"],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
}

const PAGE = `
  <main>We build billing tools.</main>
  <form>
    <label for="a">First name</label><input id="a" />
    <label for="ref">Referral code</label><input id="ref" />
    <label for="w">Why do you want to work here?</label><textarea id="w"></textarea>
  </form>`

// Builds a profile store holding the given profile, or nothing.
function storeHolding(profile: unknown): ProfileStore {
  return { load: async () => profile as Profile | undefined, save: async () => undefined }
}

// Builds a model stand-in with one fixed answer: field 0 is the referral code, field 1 the written question.
function llmAnswering(answer: unknown = { answers: [{ id: 1, answer: "Because I like billing." }] }) {
  const prompts: string[] = []
  const llm: LLMClient = {
    completeJson: vi.fn(async (prompt: string) => {
      prompts.push(prompt)
      return answer
    }),
  }
  return { llm, prompts }
}

beforeEach(() => {
  document.head.innerHTML = ""
  document.title = "Software Engineer at Example Co."
  document.body.innerHTML = PAGE
})

describe("runFill: before filling", () => {
  test("asks the user to save a profile first when there is none", async () => {
    const { llm } = llmAnswering()

    const message = await runFill(storeHolding(undefined), llm)

    expect(message).toEqual({
      type: "fill-result",
      result: { ok: false, error: "No saved profile yet. Fill in and save the form in this popup first." },
    })
    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("names what is wrong with a saved profile that is no longer valid", async () => {
    const stale = { ...PROFILE, answers: { workAuthorization: "Citizen", needsSponsorship: false } }
    const { llm } = llmAnswering()

    const message = await runFill(storeHolding(stale), llm)

    expect(message.result.ok).toBe(false)
    if (!message.result.ok) {
      expect(message.result.error).toContain("Your saved profile needs fixing")
      expect(message.result.error).toContain("answers.isAuthorizedToWork")
    }
    expect(document.getElementById("a")).toHaveProperty("value", "")
  })

  test("replies with the error when something unexpected goes wrong", async () => {
    const store: ProfileStore = {
      load: async () => {
        throw new Error("storage unavailable")
      },
      save: async () => undefined,
    }

    const message = await runFill(store, llmAnswering().llm)

    expect(message).toEqual({ type: "fill-result", result: { ok: false, error: "storage unavailable" } })
  })
})

describe("runFill: filling the page", () => {
  test("fills with the rules and the AI, and reports the counts", async () => {
    const { llm } = llmAnswering()

    const message = await runFill(storeHolding(PROFILE), llm)

    expect((document.getElementById("a") as HTMLInputElement).value).toBe("Pranav")
    expect((document.getElementById("w") as HTMLTextAreaElement).value).toBe("Because I like billing.")
    expect(message.result.ok).toBe(true)
    if (message.result.ok) {
      expect(message.result.summary).toMatchObject({ filled: 1, drafted: 1, unmatched: 1 })
      expect(message.result.notes).toEqual([])
    }
  })

  test("gives the model the job page text, without the form", async () => {
    const { llm, prompts } = llmAnswering()

    await runFill(storeHolding(PROFILE), llm)

    const jobSection = prompts[0]!.split("Job page text")[1]!.split("Fields (JSON)")[0]!
    expect(jobSection).toContain("Software Engineer at Example Co.")
    expect(jobSection).toContain("We build billing tools.")
    expect(jobSection).not.toContain("Referral code")
  })

  test("outlines fields that need the user and fields the AI wrote", async () => {
    await runFill(storeHolding(PROFILE), llmAnswering().llm)

    expect(document.getElementById("ref")?.getAttribute("data-auto-applier")).toBe("unmatched")
    expect(document.getElementById("w")?.getAttribute("data-auto-applier")).toBe("review")
    expect(document.getElementById("a")?.hasAttribute("data-auto-applier")).toBe(false)
  })

  test("still fills with the rules and passes on a note when the model is unavailable", async () => {
    const llm: LLMClient = {
      completeJson: async () => {
        throw new Error("No Gemini API key is set. Add one in the extension's LLM settings.")
      },
    }

    const message = await runFill(storeHolding(PROFILE), llm)

    expect((document.getElementById("a") as HTMLInputElement).value).toBe("Pranav")
    expect(message.result.ok).toBe(true)
    if (message.result.ok) {
      expect(message.result.notes).toEqual(["AI help skipped: No Gemini API key is set. Add one in the extension's LLM settings."])
    }
  })
})

describe("runFill: the resume upload", () => {
  const PROFILE_WITH_RESUME: Profile = {
    ...PROFILE,
    resume: { name: "resume.pdf", mimeType: "application/pdf", storageKey: "resume" },
  }

  test("fetches the saved resume for a resume upload field", async () => {
    document.body.innerHTML = `<form><label for="r">Resume/CV</label><input id="r" type="file" /></form>`
    const loadResume = vi.fn(async () => undefined)

    await runFill(storeHolding(PROFILE_WITH_RESUME), llmAnswering().llm, loadResume)

    expect(loadResume).toHaveBeenCalledTimes(1)
  })

  test("does not fetch the resume when the page has no resume upload", async () => {
    const loadResume = vi.fn(async () => undefined)

    await runFill(storeHolding(PROFILE_WITH_RESUME), llmAnswering().llm, loadResume)

    expect(loadResume).not.toHaveBeenCalled()
  })

  test("does not fetch the resume when the profile has none saved", async () => {
    document.body.innerHTML = `<form><label for="r">Resume/CV</label><input id="r" type="file" /></form>`
    const loadResume = vi.fn(async () => undefined)

    await runFill(storeHolding(PROFILE), llmAnswering().llm, loadResume)

    expect(loadResume).not.toHaveBeenCalled()
  })
})

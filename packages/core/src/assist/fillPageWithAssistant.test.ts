// Tests that the LLM is asked for help only where the rules could not decide, sees only what it should, and fails safely.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import type { FieldReport } from "../fill/fillPage"
import type { LLMClient } from "../ports/LLMClient"
import type { Profile } from "../profile/types"
import { fillPageWithAssistant } from "./fillPageWithAssistant"

const profile: Profile = {
  personal: { firstName: "Pranav", lastName: "Pattanashetty", email: "pranav@example.com", phone: "5551234567", country: "United States", links: {} },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built the billing system" }],
  education: [],
  skills: ["TypeScript"],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true, salaryExpectation: "123456" },
}

const PRIVATE_VALUES = ["pranav@example.com", "5551234567", "123456", "Pattanashetty"]

type Stage = "map" | "pick" | "answer"
type Script = { map?: unknown; pick?: unknown; answer?: unknown; failOn?: Stage; error?: Error }

// Works out which kind of request a prompt is from its opening sentence.
function stageOf(prompt: string): Stage {
  if (prompt.startsWith("You match fields")) return "map"
  if (prompt.startsWith("You choose which option")) return "pick"
  if (prompt.startsWith("You draft short answers")) return "answer"
  throw new Error("Unexpected prompt")
}

// Builds a model stand-in that answers each kind of request from the script, and can fail one of them.
function scriptedLlm(script: Script) {
  const prompts: string[] = []
  const llm: LLMClient = {
    completeJson: vi.fn(async (prompt: string) => {
      prompts.push(prompt)
      const stage = stageOf(prompt)
      if (script.failOn === stage) throw script.error ?? new Error("The model failed")
      if (stage === "map") return script.map ?? { matches: [] }
      if (stage === "pick") return script.pick ?? { choices: [] }
      return script.answer ?? { answers: [] }
    }),
  }
  return { llm, prompts }
}

// Loads the page, runs the assisted fill, and returns the result with the prompts the model saw.
async function run(html: string, script: Script = {}, jobContext?: string) {
  document.body.innerHTML = html
  const { llm, prompts } = scriptedLlm(script)
  const result = await fillPageWithAssistant(document, profile, llm, { jobContext })
  return { result, prompts, llm }
}

// Returns the report of the field with the given element id.
function reportFor(reports: FieldReport[], id: string): FieldReport {
  const found = reports.find((report) => report.field.element.id === id)
  if (!found) throw new Error(`No report for ${id}`)
  return found
}

// Returns the current value of the input, select or textarea with the given id.
function valueOf(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value
}

// Returns the prompt of the given kind that the model saw, if any.
function promptOf(prompts: string[], stage: Stage): string | undefined {
  return prompts.find((prompt) => stageOf(prompt) === stage)
}

const SPONSORSHIP_SELECT = `
  <label for="s">Do you require visa sponsorship?</label>
  <select id="s">
    <option value="">Select…</option>
    <option value="1">I require sponsorship</option>
    <option value="2">I do not require sponsorship</option>
  </select>`

const QUESTION = `<label for="w">Why do you want to work here?</label><textarea id="w"></textarea>`

describe("fillPageWithAssistant: when the rules are enough", () => {
  test("does not call the model and adds no notes", async () => {
    const { result, llm } = await run(
      `<label for="a">First name</label><input id="a" /><label for="b">Email</label><input id="b" type="email" />`,
    )

    expect(llm.completeJson).not.toHaveBeenCalled()
    expect(result.notes).toEqual([])
    expect(result.reports.every((report) => report.source === undefined)).toBe(true)
    expect(valueOf("a")).toBe("Pranav")
  })

  test("keeps the reports in page order", async () => {
    const { result } = await run(`<label for="a">First name</label><input id="a" />${QUESTION}<label for="b">Email</label><input id="b" />`)

    expect(result.reports.map((report) => report.field.element.id)).toEqual(["a", "w", "b"])
  })
})

describe("fillPageWithAssistant: matching unrecognised fields", () => {
  const CONTACT = `<label for="c">Contact number</label><input id="c" />`

  test("fills a field the model matched to a profile key, and marks it as AI work", async () => {
    const { result } = await run(CONTACT, { map: { matches: [{ id: 0, key: "phone" }] } })

    expect(valueOf("c")).toBe("5551234567")
    expect(reportFor(result.reports, "c")).toMatchObject({ profileKey: "phone", outcome: { status: "filled" }, source: "ai" })
  })

  test("leaves a field alone when the model says none", async () => {
    const { result } = await run(CONTACT, { map: { matches: [{ id: 0, key: "none" }] } })

    expect(valueOf("c")).toBe("")
    expect(reportFor(result.reports, "c").outcome).toEqual({ status: "unmatched" })
  })

  test("ignores a key that does not exist", async () => {
    const { result } = await run(CONTACT, { map: { matches: [{ id: 0, key: "favouriteColour" }] } })

    expect(valueOf("c")).toBe("")
    expect(reportFor(result.reports, "c").outcome).toEqual({ status: "unmatched" })
  })

  test("reports no-value when the matched key has nothing in the profile", async () => {
    const { result } = await run(`<label for="p">Profile page</label><input id="p" />`, {
      map: { matches: [{ id: 0, key: "linkedin" }] },
    })

    expect(reportFor(result.reports, "p")).toMatchObject({ outcome: { status: "no-value", profileKey: "linkedin" }, source: "ai" })
  })

  test("sends only labels, names and options, never the profile's values", async () => {
    const { prompts } = await run(`<label for="a">First name</label><input id="a" />${CONTACT}`)

    const prompt = promptOf(prompts, "map")!
    expect(prompt).toContain('"label": "Contact number"')
    expect(prompt).not.toContain('"label": "First name"')
    for (const secret of [...PRIVATE_VALUES, "Pranav"]) expect(prompt).not.toContain(secret)
  })

  test("asks only about fields that something can fill and that have a label or name", async () => {
    const { prompts } = await run(`
      <label for="r">Resume</label><input id="r" type="file" />
      <input />
      <label for="ref">Referral code</label><input id="ref" />`)

    const prompt = promptOf(prompts, "map")!
    expect(prompt).toContain('"label": "Referral code"')
    expect(prompt).not.toContain('"label": "Resume"')
    expect(prompt.match(/"id": \d+,\n\s+"label"/g)).toHaveLength(1)
  })

  test("does not call the model at all when nothing unrecognised could be asked about", async () => {
    const { llm } = await run(`<input />`)

    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("does not ask about a field the user has already filled in", async () => {
    const { llm } = await run(`<label for="c">Contact number</label><input id="c" value="mine" />`)

    expect(llm.completeJson).not.toHaveBeenCalled()
    expect(valueOf("c")).toBe("mine")
  })
})

describe("fillPageWithAssistant: choosing an option", () => {
  test("lets the model pick the option that means the known answer, then fills it", async () => {
    const { result } = await run(SPONSORSHIP_SELECT, {
      pick: { choices: [{ id: 0, option: "I do not require sponsorship" }] },
    })

    expect(valueOf("s")).toBe("2")
    expect(reportFor(result.reports, "s")).toMatchObject({
      profileKey: "needsSponsorship",
      outcome: { status: "filled" },
      source: "ai",
    })
  })

  test("works for radio groups too", async () => {
    const { result } = await run(
      `<fieldset><legend>Are you legally authorized to work in the US?</legend>
        <label><input id="y" type="radio" name="a" /> I am authorized to work</label>
        <label><input id="n" type="radio" name="a" /> I am not authorized to work</label>
      </fieldset>`,
      { pick: { choices: [{ id: 0, option: "I am authorized to work" }] } },
    )

    expect((document.getElementById("y") as HTMLInputElement).checked).toBe(true)
    expect(reportFor(result.reports, "y").source).toBe("ai")
  })

  test("works for a group of checkboxes too", async () => {
    const { result } = await run(
      `<fieldset><legend>Please select the country or countries you anticipate working in</legend>
        <label><input id="us" type="checkbox" name="c[]" /> US</label>
        <label><input id="uk" type="checkbox" name="c[]" /> UK</label>
      </fieldset>`,
      { pick: { choices: [{ id: 0, option: "US" }] } },
    )

    expect((document.getElementById("us") as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById("uk") as HTMLInputElement).checked).toBe(false)
    expect(reportFor(result.reports, "us")).toMatchObject({ profileKey: "country", outcome: { status: "filled" }, source: "ai" })
  })

  test("sends the question, the options and the one known answer, and nothing else private", async () => {
    const { prompts } = await run(SPONSORSHIP_SELECT)

    const prompt = promptOf(prompts, "pick")!
    expect(prompt).toContain("Do you require visa sponsorship?")
    expect(prompt).toContain("I do not require sponsorship")
    expect(prompt).toContain('"answer": "No"')
    for (const secret of PRIVATE_VALUES) expect(prompt).not.toContain(secret)
  })

  test("leaves the field failed when the model picks an option that was not offered", async () => {
    const { result } = await run(SPONSORSHIP_SELECT, { pick: { choices: [{ id: 0, option: "Maybe" }] } })

    expect(valueOf("s")).toBe("")
    expect(reportFor(result.reports, "s").outcome).toMatchObject({ status: "failed", code: "no-option-match" })
    expect(reportFor(result.reports, "s").source).toBeUndefined()
  })
})

describe("fillPageWithAssistant: drafting answers", () => {
  const ANSWER = { answers: [{ id: 0, answer: "I admire how Example Co builds billing tools." }] }

  test("fills a free-text question with a draft and marks it for review", async () => {
    const { result } = await run(QUESTION, { answer: ANSWER })

    expect(valueOf("w")).toBe("I admire how Example Co builds billing tools.")
    expect(reportFor(result.reports, "w")).toMatchObject({ outcome: { status: "drafted" }, source: "ai" })
  })

  test("gives the model the skills, jobs and job page text but nothing private", async () => {
    const { prompts } = await run(QUESTION, { answer: ANSWER }, "Software Engineer at Example Co.")

    const prompt = promptOf(prompts, "answer")!
    expect(prompt).toContain("TypeScript")
    expect(prompt).toContain("Acme")
    expect(prompt).toContain("Software Engineer at Example Co.")
    for (const secret of PRIVATE_VALUES) expect(prompt).not.toContain(secret)
  })

  test("says there is no job page text when none was given", async () => {
    const { prompts } = await run(QUESTION, { answer: ANSWER })

    expect(promptOf(prompts, "answer")).toContain("(none)")
  })

  test("leaves the question unmatched when the model has no answer", async () => {
    const { result } = await run(QUESTION, { answer: { answers: [{ id: 0, answer: "" }] } })

    expect(valueOf("w")).toBe("")
    expect(reportFor(result.reports, "w").outcome).toEqual({ status: "unmatched" })
  })

  test("only asks about real questions, not short ordinary fields", async () => {
    const { prompts } = await run(`<label for="ref">Referral code</label><input id="ref" />${QUESTION}`, { answer: ANSWER })

    const prompt = promptOf(prompts, "answer")!
    expect(prompt).toContain("Why do you want to work here?")
    expect(prompt).not.toContain("Referral code")
  })

  test("does not touch a question the user has already answered", async () => {
    const { llm } = await run(`<label for="w">Why do you want to work here?</label><textarea id="w">My own words</textarea>`, {
      answer: ANSWER,
    })

    expect(llm.completeJson).not.toHaveBeenCalled()
    expect(valueOf("w")).toBe("My own words")
  })
})

describe("fillPageWithAssistant: when the model is not available", () => {
  const RATE_LIMITED = new Error("Gemini returned 429: Resource exhausted")

  test("keeps what the rules did, adds a note, and stops asking after the first failure", async () => {
    const { result, llm } = await run(
      `<label for="a">First name</label><input id="a" /><label for="c">Contact number</label><input id="c" />${SPONSORSHIP_SELECT}${QUESTION}`,
      { failOn: "map", error: RATE_LIMITED },
    )

    expect(result.notes).toEqual(["AI help skipped: Gemini returned 429: Resource exhausted"])
    expect(llm.completeJson).toHaveBeenCalledTimes(1)
    expect(valueOf("a")).toBe("Pranav")
    expect(reportFor(result.reports, "c").outcome).toEqual({ status: "unmatched" })
    expect(reportFor(result.reports, "s").outcome).toMatchObject({ status: "failed", code: "no-option-match" })
  })

  test("a failure while choosing options stops the drafting of answers", async () => {
    const { result, prompts } = await run(`${SPONSORSHIP_SELECT}${QUESTION}`, { failOn: "pick", error: RATE_LIMITED })

    expect(result.notes).toEqual(["AI help skipped: Gemini returned 429: Resource exhausted"])
    expect(promptOf(prompts, "answer")).toBeUndefined()
    expect(valueOf("w")).toBe("")
  })

  test("a failure while drafting keeps the work done by the earlier steps", async () => {
    const { result } = await run(`<label for="c">Contact number</label><input id="c" />${QUESTION}`, {
      map: { matches: [{ id: 0, key: "phone" }] },
      failOn: "answer",
      error: RATE_LIMITED,
    })

    expect(result.notes).toHaveLength(1)
    expect(valueOf("c")).toBe("5551234567")
    expect(valueOf("w")).toBe("")
  })

  test("turns a failure that is not an Error into a generic note", async () => {
    document.body.innerHTML = `<label for="c">Contact number</label><input id="c" />`
    const llm: LLMClient = {
      completeJson: async () => {
        throw "weird"
      },
    }

    const result = await fillPageWithAssistant(document, profile, llm)

    expect(result.notes).toEqual(["AI help skipped: The LLM request failed"])
  })
})

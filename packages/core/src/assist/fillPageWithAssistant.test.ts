// Tests that one AI call answers what the rules could not, sees the whole profile, fills only safe fields, and fails safely.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import { ComboboxFiller } from "../filling/ComboboxFiller"
import { DEFAULT_SETUP } from "../fill/fillPage"
import type { FieldReport } from "../fill/fillPage"
import type { LLMClient } from "../ports/LLMClient"
import type { Profile } from "../profile/types"
import { fillPageWithAssistant } from "./fillPageWithAssistant"

const profile: Profile = {
  personal: {
    firstName: "Pranav",
    lastName: "Pattanashetty",
    email: "pranav@example.com",
    phone: "5551234567",
    country: "United States",
    links: {},
  },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built the billing system" }],
  education: [],
  skills: ["TypeScript"],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true, salaryExpectation: "123456" },
  notes: "Male. Asian (South Asian). Not a veteran.",
}

type Script = { answers?: { id: number; answer: string }[]; raw?: unknown; error?: Error }

// Builds a model stand-in that answers every request from the script, or fails.
function scriptedLlm(script: Script) {
  const prompts: string[] = []
  const llm: LLMClient = {
    completeJson: vi.fn(async (prompt: string) => {
      prompts.push(prompt)
      if (script.error) throw script.error
      return script.raw ?? { answers: script.answers ?? [] }
    }),
  }
  return { llm, prompts }
}

// Loads the page, runs the assisted fill, and returns the result with the prompts the model saw.
async function run(html: string, script: Script = {}, jobContext?: string, setup = DEFAULT_SETUP) {
  document.body.innerHTML = html
  const { llm, prompts } = scriptedLlm(script)
  const result = await fillPageWithAssistant(document, profile, llm, { jobContext, setup })
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

const GENDER_SELECT = `
  <label for="g">Gender</label>
  <select id="g">
    <option value="">Select…</option>
    <option>Male</option>
    <option>Female</option>
    <option>Decline to self-identify</option>
  </select>`

const REFERRAL = `<label for="r">Referral code</label><input id="r" />`
const QUESTION = `<label for="w">Why do you want to work here?</label><textarea id="w"></textarea>`

const SPONSORSHIP_SELECT = `
  <label for="s">Do you require visa sponsorship?</label>
  <select id="s">
    <option value="">Select…</option>
    <option value="1">I require sponsorship</option>
    <option value="2">I do not require sponsorship</option>
  </select>`

describe("fillPageWithAssistant: when the rules are enough", () => {
  test("never calls the model when the rules fill everything", async () => {
    const { result, llm } = await run(
      `<label for="f">First name</label><input id="f" /><label for="e">Email</label><input id="e" />`,
    )

    expect(llm.completeJson).not.toHaveBeenCalled()
    expect(result.notes).toEqual([])
    expect(valueOf("f")).toBe("Pranav")
  })
})

describe("fillPageWithAssistant: answering what is left", () => {
  test("asks once for all the leftovers, with the fields in page order", async () => {
    const { llm, prompts } = await run(`${GENDER_SELECT}${REFERRAL}${QUESTION}`)

    expect(llm.completeJson).toHaveBeenCalledTimes(1)
    const prompt = prompts[0]!
    expect(prompt.indexOf("Gender")).toBeLessThan(prompt.indexOf("Referral code"))
    expect(prompt.indexOf("Referral code")).toBeLessThan(prompt.indexOf("Why do you want"))
  })

  test("fills a dropdown with the option the model chose and marks it as the AI's work", async () => {
    const { result } = await run(GENDER_SELECT, { answers: [{ id: 0, answer: "Male" }] })

    expect(valueOf("g")).toBe("Male")
    expect(reportFor(result.reports, "g")).toMatchObject({ outcome: { status: "filled" }, source: "ai" })
  })

  test("fills a plain text field with the model's answer", async () => {
    const { result } = await run(REFERRAL, { answers: [{ id: 0, answer: "FRIEND42" }] })

    expect(valueOf("r")).toBe("FRIEND42")
    expect(reportFor(result.reports, "r").source).toBe("ai")
  })

  test("picks the option for a question the rules recognised but could not match to an option", async () => {
    const { result } = await run(SPONSORSHIP_SELECT, { answers: [{ id: 0, answer: "I do not require sponsorship" }] })

    expect(valueOf("s")).toBe("2")
    expect(reportFor(result.reports, "s")).toMatchObject({ profileKey: "needsSponsorship", outcome: { status: "filled" }, source: "ai" })
  })

  test("fills a radio group and a group of checkboxes", async () => {
    const { result } = await run(
      `<fieldset><legend>Are you Hispanic or Latino?</legend>
        <label><input id="yes" type="radio" name="h" /> Yes</label>
        <label><input id="no" type="radio" name="h" /> No</label></fieldset>
       <fieldset><legend>Which regions interest you?</legend>
        <label><input id="na" type="checkbox" name="reg[]" /> North America</label>
        <label><input id="eu" type="checkbox" name="reg[]" /> Europe</label></fieldset>`,
      {
        answers: [
          { id: 0, answer: "No" },
          { id: 1, answer: "North America" },
        ],
      },
    )

    expect((document.getElementById("no") as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById("na") as HTMLInputElement).checked).toBe(true)
    expect(reportFor(result.reports, "yes").source).toBe("ai")
    expect(reportFor(result.reports, "na").source).toBe("ai")
  })

  test("asks about a field the profile had no value for, and fills it if the model can answer", async () => {
    const { result } = await run(`<label for="n">Notice period</label><input id="n" />`, { answers: [{ id: 0, answer: "Two weeks" }] })

    expect(valueOf("n")).toBe("Two weeks")
    expect(reportFor(result.reports, "n")).toMatchObject({ outcome: { status: "filled" }, source: "ai" })
  })

  test("leaves a field untouched when the model gives no answer for it", async () => {
    const { result } = await run(GENDER_SELECT, { answers: [{ id: 0, answer: "" }] })

    expect(valueOf("g")).toBe("")
    expect(reportFor(result.reports, "g").outcome).toEqual({ status: "unmatched" })
  })

  test("ignores a choice the model made that the page does not offer", async () => {
    const { result } = await run(GENDER_SELECT, { answers: [{ id: 0, answer: "Non-binary" }] })

    expect(valueOf("g")).toBe("")
    expect(reportFor(result.reports, "g").outcome).toEqual({ status: "unmatched" })
  })

  test("reports a failed fill honestly when the model's answer cannot be put in the field", async () => {
    const { result } = await run(`<label for="r">Referral code</label><input id="r" readonly />`, { answers: [{ id: 0, answer: "X" }] })

    expect(reportFor(result.reports, "r").outcome).toMatchObject({ status: "skipped" })
    expect(reportFor(result.reports, "r").source).toBeUndefined()
  })
})

describe("fillPageWithAssistant: written questions", () => {
  test("fills a long question with the draft and marks it for review", async () => {
    const { result } = await run(QUESTION, { answers: [{ id: 0, answer: "Because I like billing." }] })

    expect(valueOf("w")).toBe("Because I like billing.")
    expect(reportFor(result.reports, "w")).toMatchObject({ outcome: { status: "drafted" }, source: "ai" })
  })

  test("sends the job page text only when there is a written question", async () => {
    const withQuestion = await run(QUESTION, {}, "We build billing tools.")
    const withoutQuestion = await run(GENDER_SELECT, {}, "We build billing tools.")

    expect(withQuestion.prompts[0]).toContain("We build billing tools.")
    expect(withoutQuestion.prompts[0]).not.toContain("We build billing tools.")
  })
})

describe("fillPageWithAssistant: what the model sees", () => {
  test("sees the whole profile, because the user chose to share it for unresolved questions", async () => {
    const { prompts } = await run(GENDER_SELECT)

    for (const fact of ["pranav@example.com", "5551234567", "123456", "Asian (South Asian)", "Built the billing system"]) {
      expect(prompts[0]).toContain(fact)
    }
  })

  test("treats the form and job page text as untrusted", async () => {
    const { prompts } = await run(GENDER_SELECT)

    expect(prompts[0]).toMatch(/untrusted/i)
  })
})

describe("fillPageWithAssistant: fields the model is never asked about", () => {
  test("a single checkbox such as a consent is never ticked by the model", async () => {
    const { prompts } = await run(`${GENDER_SELECT}<label><input id="agree" type="checkbox" /> I agree to the terms</label>`, {
      answers: [{ id: 0, answer: "Male" }],
    })

    expect(prompts[0]).not.toContain("I agree to the terms")
    expect((document.getElementById("agree") as HTMLInputElement).checked).toBe(false)
  })

  test("a file upload is not asked about", async () => {
    const { prompts } = await run(`${GENDER_SELECT}<label for="c">Cover letter</label><input id="c" type="file" />`)

    expect(prompts[0]).not.toContain("Cover letter")
  })

  test("a text field the user already filled is left alone", async () => {
    document.body.innerHTML = `${REFERRAL}${GENDER_SELECT}`
    ;(document.getElementById("r") as HTMLInputElement).value = "MINE"
    const { llm } = scriptedLlm({})
    const result = await fillPageWithAssistant(document, profile, llm)

    expect(valueOf("r")).toBe("MINE")
    expect(JSON.stringify((llm.completeJson as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("Referral code")
    expect(result.notes).toEqual([])
  })

  test("a field with neither a label nor a name is not asked about", async () => {
    const { llm } = await run(`<input />`)

    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("a dropdown that failed for a reason the model cannot fix is not asked about", async () => {
    const fast = { ...DEFAULT_SETUP, fillers: [...DEFAULT_SETUP.fillers.filter((filler) => !(filler instanceof ComboboxFiller)), new ComboboxFiller({ timeoutMs: 20, pollMs: 5 })] }
    const { prompts, result } = await run(
      `<label for="country">Country</label><input id="country" role="combobox" />${REFERRAL}`,
      { answers: [{ id: 0, answer: "FRIEND42" }] },
      undefined,
      fast,
    )

    expect(reportFor(result.reports, "country").outcome).toMatchObject({ status: "failed", reason: "No options appeared" })
    expect(prompts[0]).not.toContain("Country")
  })

  test("asks about at most forty fields", async () => {
    const many = Array.from({ length: 55 }, (_unused, index) => `<label for="f${index}">Question ${index}</label><input id="f${index}" />`).join("")

    const { prompts } = await run(many)

    expect(prompts[0]).toContain("Question 39")
    expect(prompts[0]).not.toContain("Question 40")
  })
})

describe("fillPageWithAssistant: when the model is not available", () => {
  test("keeps what the rules filled and adds a note when the call fails", async () => {
    const { result } = await run(
      `<label for="f">First name</label><input id="f" />${GENDER_SELECT}`,
      { error: new Error("Gemini returned 503: busy; Groq returned 429: slow down") },
    )

    expect(valueOf("f")).toBe("Pranav")
    expect(valueOf("g")).toBe("")
    expect(result.notes).toEqual(["AI help skipped: Gemini returned 503: busy; Groq returned 429: slow down"])
  })

  test("adds a note and changes nothing when the answer is not in the expected shape", async () => {
    const { result } = await run(GENDER_SELECT, { raw: { nonsense: true } })

    expect(valueOf("g")).toBe("")
    expect(result.notes[0]).toMatch(/AI help skipped: .*format/i)
  })

  test("uses a generic reason when something other than an error is thrown", async () => {
    document.body.innerHTML = GENDER_SELECT
    const llm: LLMClient = {
      completeJson: async () => {
        throw "weird"
      },
    }

    const result = await fillPageWithAssistant(document, profile, llm)

    expect(result.notes).toEqual(["AI help skipped: The LLM request failed"])
  })
})

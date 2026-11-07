// Tests that one AI call answers what the rules could not, sees the whole profile, fills only safe fields, and fails safely.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import { ComboboxFiller } from "../filling/ComboboxFiller"
import { DEFAULT_SETUP } from "../fill/fillPage"
import type { FieldReport } from "../fill/fillPage"
import type { FillProgress } from "../fill/progress"
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
  const result = await fillPageWithAssistant(document, profile, llm, { jobContext, setup, rescan: { waitMs: 0 } })
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

// Wires an input into a click-to-open dropdown with the given options, as React-select behaves, and returns what was chosen.
function wireDropdown(id: string, optionTexts: string[]): { chosen: () => string } {
  const input = document.getElementById(id) as HTMLInputElement
  const listbox = document.createElement("div")
  listbox.id = `${id}-list`
  listbox.setAttribute("role", "listbox")
  input.after(listbox)
  input.setAttribute("aria-controls", listbox.id)
  input.setAttribute("aria-expanded", "false")
  let chosen = ""

  // Shows the options that contain what is typed and marks the list open.
  function show(): void {
    const shown = optionTexts.filter((text) => text.toLowerCase().includes(input.value.toLowerCase()))
    listbox.replaceChildren(
      ...shown.map((text) => {
        const option = document.createElement("div")
        option.setAttribute("role", "option")
        option.textContent = text
        option.addEventListener("click", () => {
          chosen = text
          listbox.replaceChildren()
          input.setAttribute("aria-expanded", "false")
        })
        return option
      }),
    )
    input.setAttribute("aria-expanded", "true")
  }
  input.addEventListener("click", show)
  input.addEventListener("input", show)
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return
    listbox.replaceChildren()
    input.setAttribute("aria-expanded", "false")
  })
  return { chosen: () => chosen }
}

const VETERAN = `<label for="v">Veteran Status</label><input id="v" role="combobox" />`
const VETERAN_OPTIONS = ["I am a veteran", "I am not a protected veteran", "I don't wish to answer"]

// Loads the page, wires its dropdowns, then runs the assisted fill.
async function runWithDropdowns(html: string, dropdowns: Record<string, string[]>, script: Script) {
  document.body.innerHTML = html
  const wired = Object.fromEntries(Object.entries(dropdowns).map(([id, options]) => [id, wireDropdown(id, options)]))
  const { llm, prompts } = scriptedLlm(script)
  const result = await fillPageWithAssistant(document, profile, llm)
  return { result, prompts, wired }
}

describe("fillPageWithAssistant: dropdowns whose options are only known once opened", () => {
  test("the model is shown the real options of a dropdown, read by opening it", async () => {
    const { prompts } = await runWithDropdowns(VETERAN, { v: VETERAN_OPTIONS }, {})

    expect(prompts[0]).toContain("I am not a protected veteran")
    expect(prompts[0]).toContain("I don't wish to answer")
  })

  test("the model's choice is typed and picked, and reported as the AI's", async () => {
    const { result, wired } = await runWithDropdowns(VETERAN, { v: VETERAN_OPTIONS }, { answers: [{ id: 0, answer: "I am not a protected veteran" }] })

    expect(wired.v?.chosen()).toBe("I am not a protected veteran")
    expect(reportFor(result.reports, "v")).toMatchObject({ outcome: { status: "filled" }, source: "ai" })
  })

  test("a choice that is not one of the real options is ignored", async () => {
    const { result, wired } = await runWithDropdowns(VETERAN, { v: VETERAN_OPTIONS }, { answers: [{ id: 0, answer: "No" }] })

    expect(wired.v?.chosen()).toBe("")
    expect(reportFor(result.reports, "v").outcome.status).toBe("unmatched")
  })

  test("a dropdown the rules typed into and found nothing for is asked about, with its options", async () => {
    const country = `<label for="k">Please select the country where you currently reside.</label><input id="k" role="combobox" />`
    const { result, prompts, wired } = await runWithDropdowns(country, { k: ["Canada", "UAE", "US", "Other"] }, { answers: [{ id: 0, answer: "US" }] })

    expect(prompts[0]).toContain('"US"')
    expect(wired.k?.chosen()).toBe("US")
    expect(reportFor(result.reports, "k")).toMatchObject({ outcome: { status: "filled" }, source: "ai" })
  })

  test("a search box that lists nothing until typed is still asked about, as free text", async () => {
    const search = `<label for="s">Hobby</label><input id="s" role="combobox" />`
    const { prompts, wired } = await runWithDropdowns(search, { s: [] }, { answers: [{ id: 0, answer: "Chess" }] })

    expect(prompts[0]).toContain("Hobby")
    expect(wired.s?.chosen()).toBe("")
  })

  test("a dropdown is left closed after its options were read", async () => {
    await runWithDropdowns(VETERAN, { v: VETERAN_OPTIONS }, {})

    expect(document.getElementById("v")?.getAttribute("aria-expanded")).toBe("false")
  })
})

describe("fillPageWithAssistant: marking the fields the model was asked about", () => {
  test("a field the model was asked about and left blank is marked as asked", async () => {
    const { result } = await run(GENDER_SELECT, { answers: [] })

    expect(reportFor(result.reports, "g")).toMatchObject({ outcome: { status: "unmatched" }, askedAi: true })
  })

  test("a field the rules settled is not marked as asked", async () => {
    const { result } = await run(`${GENDER_SELECT}<label for="e">Email</label><input id="e" />`, { answers: [] })

    expect(reportFor(result.reports, "e").askedAi).toBeUndefined()
  })

  test("a field the model was never asked about is not marked as asked", async () => {
    const { result } = await run(`${GENDER_SELECT}<label for="c">Cover letter</label><input id="c" type="file" />`, { answers: [] })

    expect(reportFor(result.reports, "c").askedAi).toBeUndefined()
  })
})

const FAST_SETUP = { ...DEFAULT_SETUP, fillers: [...DEFAULT_SETUP.fillers.filter((filler) => !(filler instanceof ComboboxFiller)), new ComboboxFiller({ timeoutMs: 30, pollMs: 5 })] }

// Loads a page with one School dropdown, wires it, and runs the assisted fill with the given school in the profile.
async function runSchool(school: string, listed: string[], script: Script = {}) {
  document.body.innerHTML = `<label for="sc">School</label><input id="sc" role="combobox" />`
  const wired = wireDropdown("sc", listed)
  const { llm, prompts } = scriptedLlm(script)
  const withSchool = { ...profile, education: [{ school, degree: "MS", startDate: "2020" }] }
  const result = await fillPageWithAssistant(document, withSchool, llm, { setup: FAST_SETUP })
  return { result, prompts, llm, chosen: wired.chosen() }
}

describe("fillPageWithAssistant: schools and other education dropdowns", () => {
  test("a school the page spells with a hyphen is found by the rules, with no AI call", async () => {
    const { result, llm, chosen } = await runSchool("Indiana University Bloomington", ["Aalto University", "Indiana University - Bloomington"])

    expect(chosen).toBe("Indiana University - Bloomington")
    expect(reportFor(result.reports, "sc")).toMatchObject({ outcome: { status: "filled" } })
    expect(reportFor(result.reports, "sc").source).toBeUndefined()
    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("the model is shown the schools found by searching for the profile's school", async () => {
    const { prompts } = await runSchool("Indiana Institute of Tech", ["Aalto University", "Indiana Tech Academy", "Other"])

    expect(prompts[0]).toContain("Indiana Tech Academy")
  })

  test("a school the model picks is used, and reported as the AI's", async () => {
    const { result, chosen } = await runSchool("Indiana Institute of Tech", ["Aalto University", "Indiana Tech Academy", "Other"], {
      answers: [{ id: 0, answer: "Indiana Tech Academy" }],
    })

    expect(chosen).toBe("Indiana Tech Academy")
    expect(reportFor(result.reports, "sc")).toMatchObject({ outcome: { status: "filled" }, source: "ai" })
  })

  test("a school that is not in the list falls back to Other, marked for a check", async () => {
    const { result, chosen } = await runSchool("Obscure Institute of Things", ["Aalto University", "Other"])

    expect(chosen).toBe("Other")
    expect(reportFor(result.reports, "sc")).toMatchObject({ outcome: { status: "filled" }, source: "fallback" })
  })

  test("falls back to Other even when the AI step failed", async () => {
    const { result, chosen } = await runSchool("Obscure Institute of Things", ["Aalto University", "Other"], { error: new Error("Gemini returned 503") })

    expect(chosen).toBe("Other")
    expect(result.notes).toEqual(["AI help skipped: Gemini returned 503"])
  })

  test("stays flagged when the list has no Other option", async () => {
    const { result, chosen } = await runSchool("Obscure Institute of Things", ["Aalto University", "PES University"])

    expect(chosen).toBe("")
    expect(reportFor(result.reports, "sc").outcome.status).toBe("failed")
  })

  test("a school the profile does not have is not replaced by Other", async () => {
    document.body.innerHTML = `<label for="sc">School</label><input id="sc" role="combobox" />`
    const wired = wireDropdown("sc", ["Aalto University", "Other"])
    const { llm } = scriptedLlm({})

    const result = await fillPageWithAssistant(document, { ...profile, education: [] }, llm, { setup: FAST_SETUP })

    expect(wired.chosen()).toBe("")
    expect(reportFor(result.reports, "sc").outcome.status).toBe("no-value")
  })

  test("a dropdown that is not about education is never filled with Other", async () => {
    const { result, wired } = await runWithDropdowns(VETERAN, { v: ["I am a veteran", "Other"] }, {})

    expect(wired.v?.chosen()).toBe("")
    expect(reportFor(result.reports, "v").outcome.status).toBe("unmatched")
  })
})

describe("fillPageWithAssistant: progress", () => {
  // Runs the assisted fill and returns every progress report.
  async function progressOf(html: string, script: Script) {
    document.body.innerHTML = html
    const { llm } = scriptedLlm(script)
    const seen: FillProgress[] = []
    await fillPageWithAssistant(document, profile, llm, { onProgress: (progress) => seen.push(progress) })
    return seen
  }

  test("goes through reading, asking and answering when the rules leave something, ending with the AI's fills counted", async () => {
    const seen = await progressOf(GENDER_SELECT, { answers: [{ id: 0, answer: "Male" }] })

    const phases = [...new Set(seen.map((progress) => progress.phase))]
    expect(phases).toEqual(["rules", "reading", "asking", "answering"])
    expect(seen[seen.length - 1]).toEqual({ total: 1, filled: 1, phase: "answering" })
  })

  test("stays in the rules phase when nothing is left for the AI", async () => {
    const seen = await progressOf(`<label for="e">Email</label><input id="e" />`, {})

    expect([...new Set(seen.map((progress) => progress.phase))]).toEqual(["rules"])
  })

  test("counts what the rules filled while the AI is still working", async () => {
    const seen = await progressOf(`<label for="e">Email</label><input id="e" />${GENDER_SELECT}`, { answers: [] })

    const asking = seen.find((progress) => progress.phase === "asking")
    expect(asking).toEqual({ total: 2, filled: 1, phase: "asking" })
  })
})

// Builds a model stand-in that gives the next scripted reply on each call.
function sequencedLlm(replies: { id: number; answer: string }[][]) {
  const prompts: string[] = []
  let call = 0
  const llm: LLMClient = {
    completeJson: vi.fn(async (prompt: string) => {
      prompts.push(prompt)
      const answers = replies[Math.min(call, replies.length - 1)] ?? []
      call += 1
      return { answers }
    }),
  }
  return { llm, prompts }
}

describe("fillPageWithAssistant: context for the model", () => {
  test("sends each field's limits and help text, and the page it is on", async () => {
    document.body.innerHTML = `<label for="x">Badge name</label><input id="x" maxlength="12" aria-describedby="h"><p id="h">Shown on your name tag</p>`
    const { llm, prompts } = sequencedLlm([[]])

    await fillPageWithAssistant(document, profile, llm, {
      rescan: { waitMs: 0 },
      page: { host: "jobs.acme.com", title: "Engineer at Acme" },
    })

    expect(prompts[0]).toContain('"maxLength": 12')
    expect(prompts[0]).toContain("Shown on your name tag")
    expect(prompts[0]).toContain("jobs.acme.com")
  })
})

describe("fillPageWithAssistant: fields that appear after the first scan", () => {
  const REVEALING = `<label for="a">Preferred pronouns</label><input id="a"><div id="more"></div>`

  // Makes a second question appear once the first one is changed.
  function revealOnChange(): void {
    document.getElementById("a")?.addEventListener("change", () => {
      const more = document.getElementById("more")
      if (more && more.innerHTML === "") more.innerHTML = `<label for="b">Pronoun note</label><input id="b">`
    })
  }

  test("fills a question that was revealed by an earlier answer, in a second pass", async () => {
    document.body.innerHTML = REVEALING
    revealOnChange()
    const { llm, prompts } = sequencedLlm([[{ id: 0, answer: "they/them" }], [{ id: 0, answer: "Please use they" }]])

    const { reports } = await fillPageWithAssistant(document, profile, llm, { rescan: { waitMs: 0 } })

    expect(valueOf("b")).toBe("Please use they")
    expect(reports).toHaveLength(2)
    expect(llm.completeJson).toHaveBeenCalledTimes(2)
    expect(prompts[1]).toContain("Preferred pronouns")
    expect(prompts[1]).toContain("they/them")
  })

  test("stops when a pass finds nothing new, so one call is enough for a static page", async () => {
    document.body.innerHTML = `<label for="a">Preferred pronouns</label><input id="a">`
    const { llm } = sequencedLlm([[{ id: 0, answer: "they/them" }]])

    await fillPageWithAssistant(document, profile, llm, { rescan: { waitMs: 0 } })

    expect(llm.completeJson).toHaveBeenCalledTimes(1)
  })

  test("gives up after the allowed number of passes on a page that keeps adding fields", async () => {
    document.body.innerHTML = `<div id="box"></div>`
    let count = 0
    const add = () => {
      count += 1
      const input = document.createElement("input")
      input.id = `f${count}`
      input.setAttribute("aria-label", `Question ${count}`)
      input.addEventListener("change", add)
      document.getElementById("box")?.append(input)
    }
    add()
    const { llm } = sequencedLlm([[{ id: 0, answer: "yes" }]])

    await fillPageWithAssistant(document, profile, llm, { rescan: { waitMs: 0, passes: 2 } })

    expect(llm.completeJson).toHaveBeenCalledTimes(3)
  })

  test("counts the new fields in the progress total", async () => {
    document.body.innerHTML = REVEALING
    revealOnChange()
    const seen: FillProgress[] = []
    const { llm } = sequencedLlm([[{ id: 0, answer: "they/them" }], [{ id: 0, answer: "ok" }]])

    await fillPageWithAssistant(document, profile, llm, { rescan: { waitMs: 0 }, onProgress: (progress) => seen.push(progress) })

    expect(Math.max(...seen.map((progress) => progress.total))).toBe(2)
    expect(seen[seen.length - 1]?.filled).toBe(2)
  })
})

describe("fillPageWithAssistant: checking the work afterwards", () => {
  // Makes the page reject any value but the right one and show why.
  function rejectUnlessGood(): void {
    const input = document.getElementById("e") as HTMLInputElement
    input.addEventListener("input", () => {
      if (input.value === "E-123") input.removeAttribute("aria-invalid")
      else if (input.value !== "") input.setAttribute("aria-invalid", "true")
    })
  }
  const FORM = `<label for="e">Employee ID</label><input id="e" aria-describedby="m"><p id="m">Use the form E-123</p>`

  test("asks again, with the page's error, for a value the page rejected, and fixes it", async () => {
    document.body.innerHTML = FORM
    rejectUnlessGood()
    const { llm, prompts } = sequencedLlm([[{ id: 0, answer: "bad" }], [{ id: 0, answer: "E-123" }]])

    const { reports } = await fillPageWithAssistant(document, profile, llm, { rescan: { waitMs: 0 } })

    expect(valueOf("e")).toBe("E-123")
    expect(reports[0]?.outcome.status).toBe("filled")
    expect(prompts[1]).toContain("Use the form E-123")
  })

  test("asks only once more, then leaves a still-rejected field flagged as failed", async () => {
    document.body.innerHTML = FORM
    rejectUnlessGood()
    const { llm } = sequencedLlm([[{ id: 0, answer: "bad" }], [{ id: 0, answer: "worse" }]])

    const { reports } = await fillPageWithAssistant(document, profile, llm, { rescan: { waitMs: 0 } })

    expect(llm.completeJson).toHaveBeenCalledTimes(2)
    expect(reports[0]?.outcome).toMatchObject({ status: "failed", code: "page-rejected" })
  })
})

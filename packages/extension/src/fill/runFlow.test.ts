// Tests that "Fill and continue" fills a step, presses Next, fills the next step, and stops before Submit with an honest summary.
// @vitest-environment jsdom
import type { LLMClient, Profile, ProfileStore } from "@auto-applier/core"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { FlowState } from "../messaging"
import type { FlowStatePort } from "./flowState"
import { runFlow } from "./runFlow"

const PROFILE: Profile = {
  personal: { firstName: "Pranav", lastName: "Pattanashetty", email: "pranav@example.com", phone: "5551234567", city: "Seattle", links: {} },
  experience: [],
  education: [],
  skills: [],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
}

const STEP_ONE = `<h2>Your information</h2><label for="f">First name</label><input id="f"><button type="button" id="next">Next</button>`
const STEP_TWO = `<h2>Where you live</h2><label for="c">City</label><input id="c"><button type="button" id="send">Submit application</button>`

let submitClicks: number
let state: FlowState | undefined
let flowState: FlowStatePort

// Builds a profile store holding the given profile.
function storeHolding(profile: unknown): ProfileStore {
  return { load: async () => profile as Profile | undefined, save: async () => undefined }
}

const silentLlm: LLMClient = { completeJson: vi.fn(async () => ({ answers: [] })) }

// Puts the two-step form on the page: Next shows step two, whose Submit is counted.
function loadForm(): void {
  document.title = "Engineer"
  document.body.innerHTML = STEP_ONE
  document.addEventListener("click", (event) => {
    const id = (event.target as HTMLElement).id
    if (id === "next") document.body.innerHTML = STEP_TWO
    if (id === "send") submitClicks += 1
  })
}

beforeEach(() => {
  submitClicks = 0
  state = undefined
  flowState = {
    save: vi.fn(async (next: FlowState) => { state = next }),
    load: vi.fn(async () => state),
    clear: vi.fn(async () => { state = undefined }),
  }
  loadForm()
})

describe("runFlow", () => {
  test("fills both steps, stops before Submit, and never presses Submit", async () => {
    const message = await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 } })

    expect((document.getElementById("c") as HTMLInputElement).value).toBe("Seattle")
    expect(submitClicks).toBe(0)
    expect(message.result.ok).toBe(true)
  })

  test("counts the fields of every step in the summary and says why it stopped", async () => {
    const message = await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 } })

    if (!message.result.ok) throw new Error("expected success")
    expect(message.result.summary.filled).toBe(2)
    expect(message.result.notes[0]).toMatch(/Stopped before "Submit application"/)
  })

  test("remembers the step before pressing Next and forgets it when the flow ends", async () => {
    await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 } })

    expect(flowState.save).toHaveBeenCalledWith(expect.objectContaining({ step: 1 }))
    expect(flowState.clear).toHaveBeenCalled()
  })

  test("carries on from the step a reloaded page was at", async () => {
    document.body.innerHTML = STEP_TWO

    const message = await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 }, startAt: 1 })

    if (!message.result.ok) throw new Error("expected success")
    expect(message.result.summary.filled).toBe(1)
  })

  test("remembers that guessing is on, so a flow carried on after a reload keeps it on", async () => {
    await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 }, guessRequired: true })

    expect(flowState.save).toHaveBeenCalledWith(expect.objectContaining({ step: 1, guess: true }))
  })

  test("does not turn guessing on by itself", async () => {
    await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 } })

    expect(flowState.save).toHaveBeenCalledWith({ step: 1, clickedAt: expect.any(Number) })
  })

  test("lists the required answers the AI had to guess, so the person can check them", async () => {
    document.body.innerHTML = `<label for="r">Years of Rust experience</label><input id="r" required><label for="x">Hobby</label><input id="x">`
    const guessing: LLMClient = { completeJson: vi.fn(async () => ({ answers: [{ id: 0, answer: "2", guess: true }, { id: 1, answer: "chess", guess: true }] })) }

    const message = await runFlow({ store: storeHolding(PROFILE), llm: guessing, flowState, rescan: { waitMs: 0 }, guessRequired: true })

    if (!message.result.ok) throw new Error("expected success")
    expect(message.result.notes.join(" ")).toMatch(/guessed[^.]*Years of Rust experience/i)
    expect(message.result.notes.join(" ")).not.toContain("Hobby")
  })

  test("replies with the error when there is no saved profile", async () => {
    const message = await runFlow({ store: storeHolding(undefined), llm: silentLlm, flowState, rescan: { waitMs: 0 } })

    expect(message.result).toMatchObject({ ok: false, error: expect.stringContaining("No saved profile") })
    expect(flowState.clear).toHaveBeenCalled()
  })

  test("stops when the person presses Stop", async () => {
    const message = await runFlow({ store: storeHolding(PROFILE), llm: silentLlm, flowState, rescan: { waitMs: 0 }, isStopped: () => true })

    if (!message.result.ok) throw new Error("expected success")
    expect(message.result.notes[0]).toMatch(/stopped/i)
    expect(document.getElementById("next")).not.toBeNull()
  })
})

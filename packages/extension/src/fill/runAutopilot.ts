// Carries out an apply-by-link run on a page: finds the button that opens the application (rules, then a known address, then the AI), and starts filling once the form is there.
import { applyCandidates, applyUrlFor, candidateElement, chooseApplyWithAi, findApplyButton, hasApplicationForm } from "@auto-applier/core"
import type { LLMClient, PageInfo } from "@auto-applier/core"
import type { AutopilotState, FillResultMessage } from "../messaging"
import type { AutopilotPort } from "./autopilotState"

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> }

export type AutopilotDeps = {
  root: Document
  port: AutopilotPort
  llm: LLMClient
  page: () => PageInfo
  address: () => string
  isTop: boolean
  startFlow: () => void
  navigate: (url: string) => void
  report: (message: FillResultMessage) => void
  clock?: Clock
  findMs?: number
  afterClickMs?: number
  pollMs?: number
}

const REAL_CLOCK: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }
const DEFAULT_FIND_MS = 20_000
const DEFAULT_AFTER_CLICK_MS = 8000
const DEFAULT_POLL_MS = 700
const MAX_APPLY_CLICKS = 5
const GIVE_UP: FillResultMessage = {
  type: "fill-result",
  result: { ok: false, error: "Could not find an Apply button or an application form on this page. Open the application yourself, then press Fill and continue." },
}

type Timing = { clock: Clock; findMs: number; afterClickMs: number; pollMs: number }

// Waits up to the given time for the page to show an application form; returns whether it did.
async function waitForForm(deps: AutopilotDeps, timing: Timing, ms: number): Promise<boolean> {
  const deadline = timing.clock.now() + ms
  while (timing.clock.now() < deadline) {
    if (hasApplicationForm(deps.root)) return true
    await timing.clock.sleep(timing.pollMs)
  }
  return hasApplicationForm(deps.root)
}

// Ends the run record and starts filling the form.
async function begin(deps: AutopilotDeps): Promise<void> {
  await deps.port.clear()
  deps.startFlow()
}

// Looks for the form or the Apply button for the given time, pressing Apply when it appears; returns the run's state, or undefined once filling has started.
async function lookFor(deps: AutopilotDeps, timing: Timing, start: AutopilotState, ms: number): Promise<AutopilotState | undefined> {
  let state = start
  const deadline = timing.clock.now() + ms
  while (timing.clock.now() < deadline) {
    if (hasApplicationForm(deps.root)) return void (await begin(deps))

    const button = findApplyButton(deps.root)
    if (button.kind === "apply" && state.applyClicks < MAX_APPLY_CLICKS) {
      state = { ...state, applyClicks: state.applyClicks + 1 }
      await deps.port.save(state)
      button.element.click()
      if (await waitForForm(deps, timing, timing.afterClickMs)) return void (await begin(deps))
    }
    await timing.clock.sleep(timing.pollMs)
  }
  return state
}

// Asks the AI which clickable thing opens the application and presses it; returns whether anything was pressed, with the updated state.
async function pressWhatTheAiPicks(deps: AutopilotDeps, state: AutopilotState): Promise<{ pressed: boolean; state: AutopilotState }> {
  const marked = { ...state, aiTried: true }
  await deps.port.save(marked)
  const index = await chooseApplyWithAi(deps.llm, applyCandidates(deps.root), deps.page())
  const element = index === undefined ? undefined : candidateElement(deps.root, index)
  if (!element || marked.applyClicks >= MAX_APPLY_CLICKS) return { pressed: false, state: marked }

  const pressedState = { ...marked, applyClicks: marked.applyClicks + 1 }
  await deps.port.save(pressedState)
  element.click()
  return { pressed: true, state: pressedState }
}

// Runs the apply-by-link steps on this page. A frame inside the page only fills a form it holds; the top page does the looking.
export async function runAutopilot(deps: AutopilotDeps): Promise<void> {
  const start = await deps.port.load()
  if (!start) return

  const timing: Timing = {
    clock: deps.clock ?? REAL_CLOCK,
    findMs: deps.findMs ?? DEFAULT_FIND_MS,
    afterClickMs: deps.afterClickMs ?? DEFAULT_AFTER_CLICK_MS,
    pollMs: deps.pollMs ?? DEFAULT_POLL_MS,
  }
  if (hasApplicationForm(deps.root)) return begin(deps)
  if (!deps.isTop) {
    if (await waitForForm(deps, timing, timing.findMs)) await begin(deps)
    return
  }

  let state = await lookFor(deps, timing, start, timing.findMs)
  if (!state) return

  const variant = state.urlTried ? undefined : applyUrlFor(deps.address())
  if (variant) {
    await deps.port.save({ ...state, urlTried: true })
    deps.navigate(variant)
    return
  }
  if (!state.aiTried) {
    const picked = await pressWhatTheAiPicks(deps, state)
    state = picked.state
    if (picked.pressed) {
      if (await waitForForm(deps, timing, timing.afterClickMs)) return begin(deps)
      state = (await lookFor(deps, timing, state, timing.afterClickMs)) ?? undefined
      if (!state) return
    }
  }
  await deps.port.clear()
  deps.report(GIVE_UP)
}

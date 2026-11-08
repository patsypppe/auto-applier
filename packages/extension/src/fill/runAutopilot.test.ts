// Tests that a link run finds the Apply button (rules, then a known address, then the AI), fills the form once it appears, and gives up honestly.
// @vitest-environment jsdom
import type { LLMClient } from "@auto-applier/core"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { AutopilotState, FillResultMessage } from "../messaging"
import type { AutopilotPort } from "./autopilotState"
import { runAutopilot } from "./runAutopilot"
import type { AutopilotDeps } from "./runAutopilot"

const START: AutopilotState = { startedAt: 1000, url: "https://jobs.acme.com/1", applyClicks: 0 }
const FORM = `<label for="a">A</label><input id="a"><label for="b">B</label><input id="b"><label for="c">C</label><input id="c">`

let state: AutopilotState | undefined
let clock: number

// Builds a port that keeps the state in memory.
function memoryPort(): AutopilotPort {
  return {
    load: vi.fn(async () => state),
    save: vi.fn(async (next: AutopilotState) => { state = next }),
    clear: vi.fn(async () => { state = undefined }),
  }
}

// Builds the dependencies: time moves only when the run sleeps.
function deps(overrides: Partial<AutopilotDeps> = {}) {
  const startFlow = vi.fn()
  const navigate = vi.fn()
  const report = vi.fn<(message: FillResultMessage) => void>()
  const llm: LLMClient = { completeJson: vi.fn(async () => ({ index: null })) }
  const flow: AutopilotDeps = {
    root: document,
    port: memoryPort(),
    llm,
    page: () => ({ host: "jobs.acme.com", title: "Engineer" }),
    address: () => "https://example.com/careers/1",
    isTop: true,
    startFlow,
    navigate,
    report,
    clock: { now: () => clock, sleep: async (ms: number) => { clock += ms } },
    findMs: 3000,
    afterClickMs: 2000,
    pollMs: 500,
    ...overrides,
  }
  return { flow, startFlow, navigate, report, llm }
}

beforeEach(() => {
  state = { ...START }
  clock = 1000
  document.body.innerHTML = ""
})

describe("runAutopilot: nothing to do or the form is already there", () => {
  test("does nothing when no link run is going on in this tab", async () => {
    state = undefined
    const { flow, startFlow, report } = deps()

    await runAutopilot(flow)

    expect(startFlow).not.toHaveBeenCalled()
    expect(report).not.toHaveBeenCalled()
  })

  test("fills the form straight away when the page already shows one, and ends the run record", async () => {
    document.body.innerHTML = FORM
    const { flow, startFlow } = deps()

    await runAutopilot(flow)

    expect(startFlow).toHaveBeenCalledTimes(1)
    expect(state).toBeUndefined()
  })
})

describe("runAutopilot: finding the Apply button", () => {
  test("presses Apply, counts the press, and fills the form that appears", async () => {
    document.body.innerHTML = `<button id="apply">Apply now</button>`
    document.getElementById("apply")!.addEventListener("click", () => { document.body.innerHTML = FORM })
    const { flow, startFlow } = deps()

    await runAutopilot(flow)

    expect(startFlow).toHaveBeenCalledTimes(1)
    expect(flow.port.save).toHaveBeenCalledWith(expect.objectContaining({ applyClicks: 1 }))
  })

  test("keeps looking while the page is still drawing, and presses Apply once it appears", async () => {
    const { flow, startFlow } = deps({
      clock: { now: () => clock, sleep: async (ms: number) => {
        clock += ms
        if (clock >= 2000 && !document.getElementById("apply")) {
          document.body.innerHTML = `<a id="apply" href="#">Apply</a>`
          document.getElementById("apply")!.addEventListener("click", () => { document.body.innerHTML = FORM })
        }
      } },
    })

    await runAutopilot(flow)

    expect(startFlow).toHaveBeenCalledTimes(1)
  })

  test("does not press Apply more than the allowed number of times", async () => {
    state = { ...START, applyClicks: 5 }
    document.body.innerHTML = `<button id="apply">Apply</button>`
    const clicked = vi.fn()
    document.getElementById("apply")!.addEventListener("click", clicked)
    const { flow } = deps()

    await runAutopilot(flow)

    expect(clicked).not.toHaveBeenCalled()
  })

  test("never presses a form's own submit button", async () => {
    document.body.innerHTML = `<form><input name="x"><input type="submit" value="Apply"></form>`
    const clicked = vi.fn()
    document.querySelector("input[type=submit]")!.addEventListener("click", clicked)
    const { flow } = deps()

    await runAutopilot(flow)

    expect(clicked).not.toHaveBeenCalled()
  })
})

describe("runAutopilot: when the rules cannot find it", () => {
  test("goes to the known application address of the job board", async () => {
    document.body.innerHTML = `<p>Nothing to press</p>`
    const { flow, navigate } = deps({ address: () => "https://jobs.lever.co/acme/abc" })

    await runAutopilot(flow)

    expect(navigate).toHaveBeenCalledWith("https://jobs.lever.co/acme/abc/apply")
    expect(flow.port.save).toHaveBeenCalledWith(expect.objectContaining({ urlTried: true }))
  })

  test("asks the AI which button opens the application, and presses that one", async () => {
    document.body.innerHTML = `<button id="join">Join our team</button><button id="more">Learn more</button>`
    const joined = vi.fn()
    document.getElementById("join")!.addEventListener("click", () => { joined(); document.body.innerHTML = FORM })
    const { flow, startFlow, llm } = deps()
    vi.mocked(llm.completeJson).mockResolvedValueOnce({ index: 0 })

    await runAutopilot(flow)

    expect(joined).toHaveBeenCalled()
    expect(startFlow).toHaveBeenCalledTimes(1)
    expect(flow.port.save).toHaveBeenCalledWith(expect.objectContaining({ aiTried: true }))
  })

  test("asks the AI only once per run", async () => {
    state = { ...START, aiTried: true, urlTried: true }
    document.body.innerHTML = `<button>Join our team</button>`
    const { flow, llm } = deps()

    await runAutopilot(flow)

    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("gives up honestly, reports it, and ends the run record", async () => {
    document.body.innerHTML = `<p>Closed</p>`
    const { flow, report, startFlow } = deps()

    await runAutopilot(flow)

    expect(startFlow).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith({ type: "fill-result", result: { ok: false, error: expect.stringMatching(/Apply button/i) } })
    expect(state).toBeUndefined()
  })
})

describe("runAutopilot: frames inside the page", () => {
  test("a frame that is not the top page fills a form it contains", async () => {
    document.body.innerHTML = FORM
    const { flow, startFlow } = deps({ isTop: false })

    await runAutopilot(flow)

    expect(startFlow).toHaveBeenCalledTimes(1)
  })

  test("a frame that is not the top page never presses Apply and never reports a failure", async () => {
    document.body.innerHTML = `<button id="apply">Apply</button>`
    const clicked = vi.fn()
    document.getElementById("apply")!.addEventListener("click", clicked)
    const { flow, report } = deps({ isTop: false })

    await runAutopilot(flow)

    expect(clicked).not.toHaveBeenCalled()
    expect(report).not.toHaveBeenCalled()
  })
})

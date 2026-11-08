// Tests the multi-step loop: fill a step, press Next, fill the next one, and stop for the person at every defined stop sign.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest"
import { discoverFields } from "../fields/discoverFields"
import type { FieldReport } from "../fill/fillPage"
import { runSteps } from "./runSteps"
import type { FlowDeps, StepResult } from "./runSteps"

// Builds reports for every field on the page, all with the given outcome.
function reportsFor(status: "filled" | "unmatched"): FieldReport[] {
  return discoverFields(document).map((field) => ({
    field,
    outcome: status === "filled" ? { status: "filled" as const } : { status: "unmatched" as const },
  }))
}

// A page with a Next button that swaps in step two, whose button is Submit.
const STEP_ONE = `<h2>Step one</h2><label for="a">First name</label><input id="a"><button id="next">Next</button>`
const STEP_TWO = `<h2>Step two</h2><label for="b">City</label><input id="b"><button id="send">Submit application</button>`

// Builds the loop's dependencies with a fill that reports everything filled, and a Next button that shows step two.
function deps(overrides: Partial<FlowDeps> = {}): FlowDeps {
  return {
    root: document,
    fillStep: vi.fn(async (): Promise<StepResult> => ({ reports: reportsFor("filled"), notes: [] })),
    click: (element) => {
      if (element.id === "next") document.body.innerHTML = STEP_TWO
    },
    changeTimeoutMs: 20,
    pollMs: 1,
    ...overrides,
  }
}

beforeEach(() => {
  document.body.innerHTML = STEP_ONE
})

describe("runSteps: moving through steps", () => {
  test("fills a step, presses Next, fills the next one and stops at the submit button without pressing it", async () => {
    const clicked: string[] = []
    const flow = deps({ click: (element) => { clicked.push(element.id); if (element.id === "next") document.body.innerHTML = STEP_TWO } })

    const result = await runSteps(flow)

    expect(result.steps).toHaveLength(2)
    expect(clicked).toEqual(["next"])
    expect(result.end.reason).toBe("submit-reached")
    expect(result.end.detail).toContain("Submit application")
  })

  test("collects the reports and notes of every step", async () => {
    const flow = deps({ fillStep: vi.fn(async (step: number): Promise<StepResult> => ({ reports: reportsFor("filled"), notes: [`note ${step}`] })) })

    const result = await runSteps(flow)

    expect(result.notes).toEqual(["note 1", "note 2"])
    expect(result.steps.map((step) => step.number)).toEqual([1, 2])
  })

  test("stops when the page has no Next button", async () => {
    document.body.innerHTML = `<label for="a">Name</label><input id="a">`

    expect((await runSteps(deps())).end.reason).toBe("no-next")
  })

  test("continues numbering from where an earlier page load left off", async () => {
    const flow = deps({ startAt: 3 })

    const result = await runSteps(flow)

    expect(result.steps.map((step) => step.number)).toEqual([4, 5])
  })
})

describe("runSteps: stopping for the person", () => {
  test("stops without pressing Next when a required field was not filled", async () => {
    document.body.innerHTML = `<label for="a">First name</label><input id="a" required><button id="next">Next</button>`
    const click = vi.fn()

    const result = await runSteps(deps({ fillStep: async () => ({ reports: reportsFor("unmatched"), notes: [] }), click }))

    expect(click).not.toHaveBeenCalled()
    expect(result.end.reason).toBe("needs-you")
    expect(result.end.detail).toContain("First name")
  })

  test("carries on when only an optional field was left", async () => {
    document.body.innerHTML = `<label for="a">Nickname</label><input id="a"><button id="next">Next</button>`
    const flow = deps({ fillStep: async () => ({ reports: reportsFor("unmatched"), notes: [] }) })

    const result = await runSteps(flow)

    expect(result.end.reason).not.toBe("needs-you")
    expect(result.steps.length).toBeGreaterThan(1)
  })

  test("stops before filling when there is a CAPTCHA", async () => {
    document.body.innerHTML = `${STEP_ONE}<div class="g-recaptcha"></div>`
    const flow = deps()

    const result = await runSteps(flow)

    expect(result.end.reason).toBe("captcha")
    expect(flow.fillStep).not.toHaveBeenCalled()
  })

  test("stops before filling when there is a password field", async () => {
    document.body.innerHTML = `<input type="password">${STEP_ONE}`

    expect((await runSteps(deps())).end.reason).toBe("login")
  })

  test("stops when pressing Next changes nothing", async () => {
    const result = await runSteps(deps({ click: () => undefined }))

    expect(result.end.reason).toBe("stuck")
    expect(result.steps).toHaveLength(1)
  })

  test("stops at the step limit", async () => {
    const endless = deps({
      maxSteps: 2,
      click: () => {
        document.body.innerHTML = `<h2>${Math.random()}</h2><label for="n">Q</label><input id="n"><button id="next">Next</button>`
      },
    })

    const result = await runSteps(endless)

    expect(result.end.reason).toBe("limit")
    expect(result.steps).toHaveLength(2)
  })

  test("counts the steps done before a page load towards the limit", async () => {
    const result = await runSteps(deps({ startAt: 14 }))

    expect(result.end.reason).toBe("limit")
    expect(result.steps.map((step) => step.number)).toEqual([15])
  })

  test("stops when the person asks it to", async () => {
    let stop = false
    const flow = deps({ fillStep: async () => { stop = true; return { reports: reportsFor("filled"), notes: [] } }, isStopped: () => stop })

    const result = await runSteps(flow)

    expect(result.end.reason).toBe("stopped")
    expect(result.steps).toHaveLength(1)
  })

  test("stops when Next took the page to another site", async () => {
    let host = "jobs.acme.com"
    const flow = deps({ hostname: () => host, click: (element) => { if (element.id === "next") { document.body.innerHTML = STEP_TWO; host = "evil.example" } } })

    const result = await runSteps(flow)

    expect(result.end.reason).toBe("left-site")
    expect(result.steps).toHaveLength(1)
  })

  test("calls beforeClick with the step number just before pressing Next", async () => {
    const beforeClick = vi.fn()

    await runSteps(deps({ beforeClick }))

    expect(beforeClick).toHaveBeenCalledWith(1)
  })
})

// Tests that a flow carries on after a page reload only when Next was pressed a moment ago.
import { describe, expect, test, vi } from "vitest"
import type { FlowState } from "../messaging"
import type { FlowStatePort } from "./flowState"
import { pendingStep, RESUME_WINDOW_MS } from "./resumeFlow"

// Builds a flow-state port holding the given state.
function portHolding(state: FlowState | undefined): FlowStatePort {
  return { save: vi.fn(), load: vi.fn(async () => state), clear: vi.fn(async () => undefined) }
}

describe("pendingStep", () => {
  test("returns the step to carry on from when Next was pressed just now", async () => {
    const port = portHolding({ step: 3, clickedAt: 10_000 })

    expect(await pendingStep(port, 10_000 + 1000)).toBe(3)
  })

  test("returns nothing when no flow was running", async () => {
    expect(await pendingStep(portHolding(undefined), 10_000)).toBeUndefined()
  })

  test("forgets a state that is too old, so a later visit does not start filling by itself", async () => {
    const port = portHolding({ step: 3, clickedAt: 10_000 })

    expect(await pendingStep(port, 10_000 + RESUME_WINDOW_MS + 1)).toBeUndefined()
    expect(port.clear).toHaveBeenCalled()
  })

  test("returns nothing when the background cannot be reached", async () => {
    const port: FlowStatePort = { save: vi.fn(), load: vi.fn(async () => { throw new Error("no worker") }), clear: vi.fn() }

    expect(await pendingStep(port, 10_000)).toBeUndefined()
  })
})

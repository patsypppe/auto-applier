// Decides whether a freshly loaded page should carry on a flow: only when Next was pressed within the last few seconds.
import type { FlowStatePort } from "./flowState"

export const RESUME_WINDOW_MS = 20_000

// Returns the step number a flow reached before this page loaded, or undefined when there is no flow to carry on.
export async function pendingStep(port: FlowStatePort, now: number = Date.now()): Promise<number | undefined> {
  try {
    const state = await port.load()
    if (!state) return undefined
    if (now - state.clickedAt <= RESUME_WINDOW_MS) return state.step

    await port.clear()
    return undefined
  } catch {
    return undefined
  }
}

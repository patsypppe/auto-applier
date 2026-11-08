// Tests that the content script saves, reads and clears its flow state through the background worker.
import { afterEach, describe, expect, test, vi } from "vitest"
import { BackgroundFlowState } from "./BackgroundFlowState"

afterEach(() => {
  vi.unstubAllGlobals()
})

// Stubs chrome.runtime.sendMessage to answer with the given reply.
function stubMessaging(reply: unknown) {
  const sendMessage = vi.fn(async () => reply)
  vi.stubGlobal("chrome", { runtime: { sendMessage } })
  return sendMessage
}

describe("BackgroundFlowState", () => {
  test("sends the state to the worker to keep", async () => {
    const sendMessage = stubMessaging(undefined)

    await new BackgroundFlowState().save({ step: 2, clickedAt: 5 })

    expect(sendMessage).toHaveBeenCalledWith({ type: "flow-save", state: { step: 2, clickedAt: 5 } })
  })

  test("reads the state back from the worker", async () => {
    stubMessaging({ state: { step: 2, clickedAt: 5 } })

    expect(await new BackgroundFlowState().load()).toEqual({ step: 2, clickedAt: 5 })
  })

  test("reads nothing when the worker has no state or answers with rubbish", async () => {
    stubMessaging({})
    expect(await new BackgroundFlowState().load()).toBeUndefined()

    stubMessaging("rubbish")
    expect(await new BackgroundFlowState().load()).toBeUndefined()

    stubMessaging(undefined)
    expect(await new BackgroundFlowState().load()).toBeUndefined()
  })

  test("tells the worker to forget the state", async () => {
    const sendMessage = stubMessaging(undefined)

    await new BackgroundFlowState().clear()

    expect(sendMessage).toHaveBeenCalledWith({ type: "flow-clear" })
  })
})

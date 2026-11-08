// Tests that the content script tells the background worker when the top page loads, checks for a flow to carry on, and handles stop requests.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("content script", () => {
  test("announces a page load from the top frame", async () => {
    const sendMessage = vi.fn(async () => undefined)
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn() } } })

    await import("./content")

    expect(sendMessage).toHaveBeenCalledWith({ type: "page-loaded" })
  })

  test("keeps going when nobody answers the page-loaded message", async () => {
    const sendMessage = vi.fn(async () => {
      throw new Error("Receiving end does not exist.")
    })
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn() } } })

    await expect(import("./content")).resolves.toBeDefined()
  })

  test("asks the worker on load whether a Next-button flow was running, from any frame", async () => {
    const sendMessage = vi.fn(async () => ({}))
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener: vi.fn() } } })

    await import("./content")

    expect(sendMessage).toHaveBeenCalledWith({ type: "flow-get" })
  })

  test("a stop request makes the worker forget the flow", async () => {
    const sendMessage = vi.fn(async () => ({}))
    const addListener = vi.fn()
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener } } })
    await import("./content")
    const listener = addListener.mock.calls[0]?.[0] as (message: unknown) => void

    listener({ type: "stop-flow" })

    expect(sendMessage).toHaveBeenCalledWith({ type: "flow-clear" })
  })

  test("ignores messages it does not know", async () => {
    const sendMessage = vi.fn(async () => ({}))
    const addListener = vi.fn()
    vi.stubGlobal("chrome", { runtime: { sendMessage, onMessage: { addListener } } })
    await import("./content")
    const listener = addListener.mock.calls[0]?.[0] as (message: unknown) => void
    sendMessage.mockClear()

    listener({ type: "something-else" })

    expect(sendMessage).not.toHaveBeenCalled()
  })
})

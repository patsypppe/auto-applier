// Tests that the content script tells the background worker when the top page loads, so old fill results are dropped.
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
})

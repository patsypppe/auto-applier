// Tests the Fill this page panel: it asks the active tab to fill, adds up what each frame reports, and shows notes.
// @vitest-environment jsdom
import { emptySummary } from "@auto-applier/core"
import type { ReportSummary } from "@auto-applier/core"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { mountFillPanel } from "./FillPanel"

type Listener = (message: unknown) => void

let listeners: Listener[] = []
let sendMessage: ReturnType<typeof vi.fn>

// Replaces the chrome global with a fake tab list and message bus that the test can drive.
function stubChrome(tabs: { id?: number }[] = [{ id: 7 }]): void {
  listeners = []
  sendMessage = vi.fn(async () => undefined)
  vi.stubGlobal("chrome", {
    runtime: { onMessage: { addListener: (listener: Listener) => listeners.push(listener) } },
    tabs: { query: vi.fn(async () => tabs), sendMessage },
  })
}

// Delivers a result from one frame's content script to the panel.
function frameReports(summary: Partial<ReportSummary>, notes: string[] = []): void {
  const message = { type: "fill-result", result: { ok: true, summary: { ...emptySummary(), ...summary }, notes } }
  for (const listener of listeners) listener(message)
}

// Delivers a failure from one frame's content script to the panel.
function frameFails(error: string): void {
  for (const listener of listeners) listener({ type: "fill-result", result: { ok: false, error } })
}

// Presses the Fill this page button.
function pressFill(): void {
  document.querySelector("button")!.click()
}

const status = () => document.querySelector('[role="status"]')?.textContent ?? ""
const notes = () => Array.from(document.querySelectorAll(".notes li")).map((item) => item.textContent)

beforeEach(() => {
  stubChrome()
  document.body.innerHTML = '<div id="root"></div>'
  mountFillPanel(document.getElementById("root")!)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("FillPanel", () => {
  test("shows a Fill this page button", () => {
    expect(document.querySelector("button")?.textContent).toBe("Fill this page")
  })

  test("asks the active tab to fill and says it is working", async () => {
    pressFill()

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, { type: "fill-page" }))
    expect(status()).toBe("Filling…")
  })

  test("adds up what each frame reports", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())

    frameReports({ filled: 3, unmatched: 1 })
    frameReports({ filled: 2, skipped: 1 })

    expect(status()).toBe("Filled 5 · Left alone 1 · Needs you 1")
  })

  test("counts the AI's work and says how many to check", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())

    frameReports({ filled: 2, aiFilled: 1, drafted: 1 })

    expect(status()).toBe("Filled 4 · Left alone 0 · Needs you 0 · Check the AI's work on 2")
  })

  test("shows each note once, even when several frames send the same one", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())

    frameReports({ filled: 1 }, ["AI help skipped: No Gemini API key is set."])
    frameReports({ filled: 1 }, ["AI help skipped: No Gemini API key is set.", "AI help skipped: other"])

    expect(notes()).toEqual(["AI help skipped: No Gemini API key is set.", "AI help skipped: other"])
  })

  test("starts from zero again on the next press", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1))
    frameReports({ filled: 4 }, ["a note"])

    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2))
    frameReports({ filled: 1 })

    expect(status()).toBe("Filled 1 · Left alone 0 · Needs you 0")
    expect(notes()).toEqual([])
  })

  test("shows the error a frame reports", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())

    frameFails("No saved profile yet. Fill in and save the form in this popup first.")

    expect(status()).toBe("No saved profile yet. Fill in and save the form in this popup first.")
  })

  test("ignores messages that are not fill results", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())

    for (const listener of listeners) listener({ type: "llm-complete", prompt: "x" })

    expect(status()).toBe("Filling…")
  })

  test("says it could not reach the page when sending fails", async () => {
    sendMessage.mockRejectedValueOnce(new Error("Receiving end does not exist."))

    pressFill()

    await vi.waitFor(() => expect(status()).toBe("Could not reach this page. Reload the tab and try again."))
  })

  test("says it could not reach the page when there is no active tab", async () => {
    stubChrome([{}])
    document.body.innerHTML = '<div id="root"></div>'
    mountFillPanel(document.getElementById("root")!)

    pressFill()

    await vi.waitFor(() => expect(status()).toBe("Could not reach this page. Reload the tab and try again."))
  })
})

// Tests the Fill this page panel: it starts a fill, shows the saved results of every frame, and still shows them after reopening.
// @vitest-environment jsdom
import { emptySummary } from "@auto-applier/core"
import type { ReportSummary } from "@auto-applier/core"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { FrameResult } from "../fill/combineResults"
import { ChromeSessionFillStore } from "../storage/ChromeSessionFillStore"
import { createFakeSessionStorage } from "../testing/fakeSessionStorage"
import { mountFillPanel } from "./FillPanel"

let sendMessage: ReturnType<typeof vi.fn>
let store: ChromeSessionFillStore

// Replaces the chrome global with a fake tab list, session storage and message sending.
function stubChrome(tabs: { id?: number }[] = [{ id: 7 }]): void {
  const fake = createFakeSessionStorage()
  sendMessage = vi.fn(async () => undefined)
  vi.stubGlobal("chrome", { storage: fake.storage, tabs: { query: vi.fn(async () => tabs), sendMessage } })
  store = new ChromeSessionFillStore()
}

// Mounts a panel into a fresh page and waits until it has loaded what is saved.
async function mountPanel(): Promise<void> {
  document.body.innerHTML = '<div id="root"></div>'
  await mountFillPanel(document.getElementById("root")!, store)
}

// Builds a successful result for one frame.
const ok = (summary: Partial<ReportSummary>, notes: string[] = []): FrameResult => ({
  ok: true,
  summary: { ...emptySummary(), ...summary },
  notes,
})

// Presses the Fill this page button.
function pressFill(): void {
  document.querySelector("button")!.click()
}

const status = () => document.querySelector('[role="status"]')?.textContent ?? ""
const notes = () => Array.from(document.querySelectorAll(".notes li")).map((item) => item.textContent)

beforeEach(async () => {
  stubChrome()
  await mountPanel()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("FillPanel: filling", () => {
  test("shows a Fill this page button and nothing else at first", () => {
    expect(document.querySelector("button")?.textContent).toBe("Fill this page")
    expect(status()).toBe("")
  })

  test("asks the active tab to fill and says it is working", async () => {
    pressFill()

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(7, { type: "fill-page" }))
    expect(status()).toBe("Filling…")
  })

  test("adds up what each frame reports", async () => {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())

    await store.saveResult(7, 0, ok({ filled: 3, unmatched: 1 }))
    await store.saveResult(7, 1, ok({ filled: 2, skipped: 1 }))

    await vi.waitFor(() => expect(status()).toBe("Filled 5 · Left alone 1 · Needs you 1"))
  })

  test("counts the AI's work and says how many to check", async () => {
    await store.saveResult(7, 0, ok({ filled: 2, aiFilled: 1, drafted: 1 }))

    await vi.waitFor(() => expect(status()).toBe("Filled 4 · Left alone 0 · Needs you 0 · Check the AI's work on 2"))
  })

  test("shows each note once, even when several frames send the same one", async () => {
    await store.saveResult(7, 0, ok({ filled: 1 }, ["AI help skipped: No key."]))
    await store.saveResult(7, 1, ok({ filled: 1 }, ["AI help skipped: No key.", "AI help skipped: other"]))

    await vi.waitFor(() => expect(notes()).toEqual(["AI help skipped: No key.", "AI help skipped: other"]))
  })

  test("starts from zero again on the next press", async () => {
    await store.saveResult(7, 0, ok({ filled: 4 }, ["a note"]))
    await vi.waitFor(() => expect(status()).toContain("Filled 4"))

    pressFill()
    await vi.waitFor(() => expect(status()).toBe("Filling…"))
    await store.saveResult(7, 0, ok({ filled: 1 }))

    await vi.waitFor(() => expect(status()).toBe("Filled 1 · Left alone 0 · Needs you 0"))
    expect(notes()).toEqual([])
  })

  test("shows the error when every frame failed", async () => {
    await store.saveResult(7, 0, { ok: false, error: "No saved profile yet. Fill in and save the form first." })

    await vi.waitFor(() => expect(status()).toBe("No saved profile yet. Fill in and save the form first."))
  })

  test("ignores results from other tabs", async () => {
    await store.saveResult(8, 0, ok({ filled: 9 }))

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(status()).toBe("")
  })

  test("says it could not reach the page when sending fails", async () => {
    sendMessage.mockRejectedValueOnce(new Error("Receiving end does not exist."))

    pressFill()

    await vi.waitFor(() => expect(status()).toBe("Could not reach this page. Reload the tab and try again."))
  })

  test("says it could not reach the page when there is no active tab", async () => {
    stubChrome([{}])
    await mountPanel()

    pressFill()

    await vi.waitFor(() => expect(status()).toBe("Could not reach this page. Reload the tab and try again."))
  })
})

describe("FillPanel: reopening the popup", () => {
  test("shows the last result straight away when the popup is opened again", async () => {
    await store.saveResult(7, 0, ok({ filled: 5, unmatched: 2 }, ["a note"]))

    await mountPanel()

    expect(status()).toBe("Filled 5 · Left alone 0 · Needs you 2")
    expect(notes()).toEqual(["a note"])
  })

  test("says it is still filling when reopened before any frame has reported", async () => {
    await store.start(7)

    await mountPanel()

    expect(status()).toBe("Filling…")
  })

  test("shows results that arrive after the popup was reopened", async () => {
    await store.start(7)
    await mountPanel()

    await store.saveResult(7, 0, ok({ filled: 2 }))

    await vi.waitFor(() => expect(status()).toBe("Filled 2 · Left alone 0 · Needs you 0"))
  })

  test("shows nothing when the page was reloaded and its results were cleared", async () => {
    await store.saveResult(7, 0, ok({ filled: 5 }))
    await store.clear(7)

    await mountPanel()

    expect(status()).toBe("")
  })
})

describe("FillPanel: progress bar", () => {
  const bar = () => document.querySelector("progress") as HTMLProgressElement | null
  const caption = () => document.querySelector(".progress-caption")?.textContent ?? ""

  // Starts a fill and waits until the panel has asked the tab.
  async function startFill(): Promise<void> {
    pressFill()
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled())
  }

  test("shows no bar before anything has run", () => {
    expect(bar()?.hidden ?? true).toBe(true)
  })

  test("fills the bar as fields get filled, and says what the fill is doing", async () => {
    await startFill()

    await store.saveProgress(7, 0, { total: 22, filled: 12, phase: "rules" })

    await vi.waitFor(() => expect(bar()?.hidden).toBe(false))
    expect(bar()?.max).toBe(22)
    expect(bar()?.value).toBe(12)
    expect(caption()).toBe("12 of 22 filled · filling fields…")
  })

  test("names the other phases", async () => {
    await startFill()

    await store.saveProgress(7, 0, { total: 22, filled: 15, phase: "reading" })
    await vi.waitFor(() => expect(caption()).toBe("15 of 22 filled · reading dropdown options…"))

    await store.saveProgress(7, 0, { total: 22, filled: 15, phase: "asking" })
    await vi.waitFor(() => expect(caption()).toBe("15 of 22 filled · asking the AI…"))

    await store.saveProgress(7, 0, { total: 22, filled: 18, phase: "answering" })
    await vi.waitFor(() => expect(caption()).toBe("18 of 22 filled · filling the AI's answers…"))
  })

  test("adds up the frames", async () => {
    await startFill()

    await store.saveProgress(7, 0, { total: 20, filled: 8, phase: "rules" })
    await store.saveProgress(7, 1, { total: 5, filled: 5, phase: "rules" })

    await vi.waitFor(() => expect(bar()?.value).toBe(13))
    expect(bar()?.max).toBe(25)
  })

  test("once the result is in, shows the final count from it and no phase", async () => {
    await startFill()
    await store.saveProgress(7, 0, { total: 22, filled: 12, phase: "asking" })

    await store.saveResult(7, 0, ok({ filled: 10, aiFilled: 4, drafted: 1, failed: 2, unmatched: 3, noValue: 1, skipped: 1 }))

    await vi.waitFor(() => expect(caption()).toBe("15 of 22 filled"))
    expect(bar()?.value).toBe(15)
    expect(bar()?.max).toBe(22)
  })

  test("still shows the final count when the popup is opened after the fill finished", async () => {
    await store.saveResult(7, 0, ok({ filled: 6, unmatched: 2 }))

    await mountPanel()

    expect(caption()).toBe("6 of 8 filled")
  })

  test("shows no bar for a page with nothing to fill", async () => {
    await store.saveResult(7, 0, ok({}))

    await mountPanel()

    expect(bar()?.hidden ?? true).toBe(true)
  })
})

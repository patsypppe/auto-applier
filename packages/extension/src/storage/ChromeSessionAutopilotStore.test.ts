// Tests that an apply-by-link run is kept per tab, forgotten when it ends, and expires if it is left lying around.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createFakeSessionStorage } from "../testing/fakeSessionStorage"
import { AUTOPILOT_LIFETIME_MS, ChromeSessionAutopilotStore } from "./ChromeSessionAutopilotStore"

const state = (startedAt: number) => ({ startedAt, url: "https://jobs.acme.com/1", applyClicks: 0 })

beforeEach(() => {
  vi.stubGlobal("chrome", { storage: createFakeSessionStorage().storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ChromeSessionAutopilotStore", () => {
  test("has nothing for a tab that never started a run", async () => {
    expect(await new ChromeSessionAutopilotStore().load(7, 1000)).toBeUndefined()
  })

  test("returns what was saved for the tab, and keeps tabs apart", async () => {
    const store = new ChromeSessionAutopilotStore()
    await store.save(7, state(1000))

    expect(await store.load(7, 2000)).toEqual(state(1000))
    expect(await store.load(8, 2000)).toBeUndefined()
  })

  test("forgets a run when cleared", async () => {
    const store = new ChromeSessionAutopilotStore()
    await store.save(7, state(1000))

    await store.clear(7)

    expect(await store.load(7, 2000)).toBeUndefined()
  })

  test("forgets a run that is older than its lifetime, so an old tab never starts filling by itself", async () => {
    const store = new ChromeSessionAutopilotStore()
    await store.save(7, state(1000))

    expect(await store.load(7, 1000 + AUTOPILOT_LIFETIME_MS + 1)).toBeUndefined()
    expect(await store.load(7, 2000)).toBeUndefined()
  })
})

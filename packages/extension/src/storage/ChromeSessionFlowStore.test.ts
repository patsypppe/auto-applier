// Tests that how far a Next-button flow has got is kept per tab and frame, and can be read back or forgotten.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createFakeSessionStorage } from "../testing/fakeSessionStorage"
import { ChromeSessionFlowStore } from "./ChromeSessionFlowStore"

beforeEach(() => {
  vi.stubGlobal("chrome", { storage: createFakeSessionStorage().storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ChromeSessionFlowStore", () => {
  test("has nothing for a frame that never started a flow", async () => {
    expect(await new ChromeSessionFlowStore().load(7, 0)).toBeUndefined()
  })

  test("returns what was saved for the same tab and frame", async () => {
    const store = new ChromeSessionFlowStore()
    await store.save(7, 0, { step: 2, clickedAt: 1000 })

    expect(await store.load(7, 0)).toEqual({ step: 2, clickedAt: 1000 })
  })

  test("keeps tabs and frames apart", async () => {
    const store = new ChromeSessionFlowStore()
    await store.save(7, 0, { step: 2, clickedAt: 1000 })

    expect(await store.load(8, 0)).toBeUndefined()
    expect(await store.load(7, 1)).toBeUndefined()
  })

  test("forgets a frame's state when cleared", async () => {
    const store = new ChromeSessionFlowStore()
    await store.save(7, 0, { step: 2, clickedAt: 1000 })

    await store.clear(7, 0)

    expect(await store.load(7, 0)).toBeUndefined()
  })

  test("ignores stored data that is not a flow state", async () => {
    const fake = createFakeSessionStorage()
    fake.items.set("flow:7:0", { step: "two" })
    vi.stubGlobal("chrome", { storage: fake.storage })

    expect(await new ChromeSessionFlowStore().load(7, 0)).toBeUndefined()
  })
})

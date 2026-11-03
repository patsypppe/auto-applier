// Tests that fill results are kept per tab and frame in session storage, so the popup can show them after reopening.
import { emptySummary } from "@auto-applier/core"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { FrameResult } from "../fill/combineResults"
import { createFakeSessionStorage } from "../testing/fakeSessionStorage"
import { ChromeSessionFillStore } from "./ChromeSessionFillStore"

const okResult = (filled: number): FrameResult => ({ ok: true, summary: { ...emptySummary(), filled }, notes: [] })

let fake: ReturnType<typeof createFakeSessionStorage>

beforeEach(() => {
  fake = createFakeSessionStorage()
  vi.stubGlobal("chrome", { storage: fake.storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ChromeSessionFillStore: loading", () => {
  test("has nothing for a tab that never filled", async () => {
    expect(await new ChromeSessionFillStore().load(7)).toEqual({ running: false, results: [] })
  })

  test("returns the saved results of a tab in frame order", async () => {
    const store = new ChromeSessionFillStore()
    await store.saveResult(7, 2, okResult(2))
    await store.saveResult(7, 0, okResult(1))

    expect((await store.load(7)).results).toEqual([okResult(1), okResult(2)])
  })

  test("keeps tabs apart", async () => {
    const store = new ChromeSessionFillStore()
    await store.saveResult(7, 0, okResult(1))
    await store.saveResult(8, 0, okResult(9))

    expect((await store.load(7)).results).toEqual([okResult(1)])
  })

  test("does not mix up a tab with a longer id that starts with the same digits", async () => {
    const store = new ChromeSessionFillStore()
    await store.saveResult(7, 0, okResult(1))
    await store.saveResult(70, 0, okResult(9))

    expect((await store.load(7)).results).toEqual([okResult(1)])
  })

  test("ignores stored values that are not fill results", async () => {
    const store = new ChromeSessionFillStore()
    fake.items.set("fill-result:7:0", { nonsense: true })
    await store.saveResult(7, 1, okResult(3))

    expect((await store.load(7)).results).toEqual([okResult(3)])
  })
})

describe("ChromeSessionFillStore: a run", () => {
  test("start marks the tab as running and clears its old results", async () => {
    const store = new ChromeSessionFillStore()
    await store.saveResult(7, 0, okResult(4))
    await store.saveResult(8, 0, okResult(5))

    await store.start(7)

    expect(await store.load(7)).toEqual({ running: true, results: [] })
    expect((await store.load(8)).results).toEqual([okResult(5)])
  })

  test("clear forgets the tab's run and results but not other tabs", async () => {
    const store = new ChromeSessionFillStore()
    await store.start(7)
    await store.saveResult(7, 0, okResult(1))
    await store.saveResult(8, 0, okResult(2))

    await store.clear(7)

    expect(await store.load(7)).toEqual({ running: false, results: [] })
    expect((await store.load(8)).results).toEqual([okResult(2)])
  })
})

describe("ChromeSessionFillStore: change notifications", () => {
  test("tells the listener when that tab's results change", async () => {
    const store = new ChromeSessionFillStore()
    const listener = vi.fn()
    store.onChange(7, listener)

    await store.saveResult(7, 0, okResult(1))

    expect(listener).toHaveBeenCalled()
  })

  test("does not tell the listener about other tabs or other storage areas", async () => {
    const store = new ChromeSessionFillStore()
    const listener = vi.fn()
    store.onChange(7, listener)

    await store.saveResult(8, 0, okResult(1))
    for (const fireOn of fake.listeners) fireOn({ "fill-result:7:0": {} }, "local")

    expect(listener).not.toHaveBeenCalled()
  })

  test("stops telling the listener after it is removed", async () => {
    const store = new ChromeSessionFillStore()
    const listener = vi.fn()
    const stop = store.onChange(7, listener)

    stop()
    await store.saveResult(7, 0, okResult(1))

    expect(listener).not.toHaveBeenCalled()
  })
})

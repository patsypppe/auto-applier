// Tests that waitUntil resolves true as soon as a condition holds, and false when time runs out.
import { describe, expect, test, vi } from "vitest"
import { waitUntil } from "./waitUntil"

const TIMING = { timeoutMs: 100, pollMs: 5 }

describe("waitUntil", () => {
  test("resolves true straight away when the condition already holds", async () => {
    expect(await waitUntil(() => true, TIMING)).toBe(true)
  })

  test("resolves true once the condition becomes true later", async () => {
    let ready = false
    setTimeout(() => {
      ready = true
    }, 20)

    expect(await waitUntil(() => ready, TIMING)).toBe(true)
  })

  test("resolves false when the condition never holds before the timeout", async () => {
    const startedAt = Date.now()

    const result = await waitUntil(() => false, TIMING)

    expect(result).toBe(false)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(TIMING.timeoutMs - 5)
  })

  test("checks the condition again and again while it waits", async () => {
    const condition = vi.fn(() => false)

    await waitUntil(condition, TIMING)

    expect(condition.mock.calls.length).toBeGreaterThan(3)
  })

  test("stops checking once the condition holds", async () => {
    let calls = 0

    await waitUntil(() => ++calls === 3, TIMING)

    expect(calls).toBe(3)
  })
})

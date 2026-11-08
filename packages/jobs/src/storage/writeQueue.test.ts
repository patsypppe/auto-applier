// Tests that a write queue runs its tasks one at a time, in the order they were given, and keeps going after a failure.
import { describe, expect, test } from "vitest"
import { createWriteQueue } from "./writeQueue"

// Waits for the given number of milliseconds.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("createWriteQueue", () => {
  test("runs tasks given at the same time one after another, in order", async () => {
    const run = createWriteQueue()
    const events: string[] = []
    let running = 0
    let most = 0
    const task = (name: string, ms: number) => async () => {
      running += 1
      most = Math.max(most, running)
      events.push(`start ${name}`)
      await wait(ms)
      events.push(`end ${name}`)
      running -= 1
      return name
    }

    const results = await Promise.all([run(task("a", 20)), run(task("b", 5)), run(task("c", 1))])

    expect(results).toEqual(["a", "b", "c"])
    expect(most).toBe(1)
    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"])
  })

  test("gives a failed task's error to its caller and still runs the next task", async () => {
    const run = createWriteQueue()

    const failed = run(async () => {
      throw new Error("disk full")
    })
    const next = run(async () => "saved")

    await expect(failed).rejects.toThrow("disk full")
    expect(await next).toBe("saved")
  })
})

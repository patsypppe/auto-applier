// Tests that brokenRunReason refuses to replace the feed after a run where most boards failed, and accepts normal runs.
import { describe, expect, test } from "vitest"
import type { BoardResult } from "./collectBoards"
import { brokenRunReason } from "./runHealth"

// Builds results for one job site: how many boards worked and how many failed.
function results(worked: number, failed: number, status?: number): BoardResult[] {
  const ok = Array.from({ length: worked }, (_, i): BoardResult => ({ ats: "greenhouse", slug: `ok${i}`, outcome: "fetched", jobs: 5 }))
  const bad = Array.from({ length: failed }, (_, i): BoardResult => ({
    ats: "greenhouse",
    slug: `bad${i}`,
    outcome: "failed",
    jobs: 0,
    ...(status === undefined ? {} : { status }),
    error: "failed",
  }))
  return [...ok, ...bad]
}

describe("brokenRunReason", () => {
  test("accepts a normal run with a few dead boards", () => {
    expect(brokenRunReason(results(1835, 96, 404))).toBeUndefined()
  })

  test("refuses a run where no board worked", () => {
    expect(brokenRunReason(results(0, 20))).toBe("No board could be read, so the earlier feed was kept.")
  })

  test("refuses a run where more than half the boards failed", () => {
    expect(brokenRunReason(results(40, 60))).toBe("60 of 100 boards failed, so the earlier feed was kept.")
  })

  test("does not count boards that were simply not found as signs of a broken network", () => {
    expect(brokenRunReason(results(10, 30, 404))).toBeUndefined()
  })

  test("accepts a run with no boards at all as nothing to judge", () => {
    expect(brokenRunReason([])).toBeUndefined()
  })
})

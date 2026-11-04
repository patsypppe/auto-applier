// Tests that a board is marked dead only after returning 404 on two different days, and comes back once it works.
import { describe, expect, test } from "vitest"
import type { BoardResult } from "../fetching/collectBoards"
import { isDead, updateDeadBoards } from "./deadBoards"

const notFound: BoardResult = { ats: "lever", slug: "plaid", outcome: "failed", jobs: 0, status: 404, error: "404" }
const worked: BoardResult = { ats: "lever", slug: "plaid", outcome: "fetched", jobs: 3 }
const busy: BoardResult = { ats: "lever", slug: "plaid", outcome: "failed", jobs: 0, status: 503, error: "503" }

describe("updateDeadBoards", () => {
  test("remembers the first 404 but does not call the board dead yet", () => {
    const dead = updateDeadBoards({}, [notFound], "2026-11-04")

    expect(dead).toEqual({ "lever:plaid": { first404: "2026-11-04", last404: "2026-11-04" } })
    expect(isDead(dead, "lever", "plaid")).toBe(false)
  })

  test("does not count a second 404 on the same day", () => {
    const once = updateDeadBoards({}, [notFound], "2026-11-04")

    expect(isDead(updateDeadBoards(once, [notFound], "2026-11-04"), "lever", "plaid")).toBe(false)
  })

  test("calls the board dead after a 404 on a later day", () => {
    const once = updateDeadBoards({}, [notFound], "2026-11-04")

    expect(isDead(updateDeadBoards(once, [notFound], "2026-11-05"), "lever", "plaid")).toBe(true)
  })

  test("forgets the 404 once the board works again", () => {
    const once = updateDeadBoards({}, [notFound], "2026-11-04")

    expect(updateDeadBoards(once, [worked], "2026-11-05")).toEqual({})
  })

  test("ignores failures that are not 404, such as a busy server", () => {
    expect(updateDeadBoards({}, [busy], "2026-11-04")).toEqual({})
  })

  test("keeps entries for boards that were not in this run", () => {
    const earlier = { "greenhouse:gone": { first404: "2026-10-01", last404: "2026-10-02" } }

    expect(updateDeadBoards(earlier, [worked], "2026-11-04")).toEqual(earlier)
  })
})

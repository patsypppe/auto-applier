// Tests that a board is marked dead only after returning 404 twice at least 20 hours apart, and comes back once it works.
import { describe, expect, test } from "vitest"
import type { BoardResult } from "../fetching/collectBoards"
import { isDead, updateDeadBoards } from "./deadBoards"

const notFound: BoardResult = { ats: "lever", slug: "plaid", outcome: "failed", jobs: 0, status: 404, error: "404" }
const worked: BoardResult = { ats: "lever", slug: "plaid", outcome: "fetched", jobs: 3 }
const busy: BoardResult = { ats: "lever", slug: "plaid", outcome: "failed", jobs: 0, status: 503, error: "503" }

const AFTERNOON = new Date("2026-11-04T23:09:00Z")
const hoursLater = (hours: number) => new Date(AFTERNOON.getTime() + hours * 3_600_000)

describe("updateDeadBoards", () => {
  test("remembers the first 404 but does not call the board dead yet", () => {
    const dead = updateDeadBoards({}, [notFound], AFTERNOON)

    expect(dead).toEqual({ "lever:plaid": { first404: AFTERNOON.toISOString(), last404: AFTERNOON.toISOString() } })
    expect(isDead(dead, { ats: "lever", slug: "plaid" })).toBe(false)
  })

  test("does not call a board dead when two 404s fall on different UTC dates but only hours apart", () => {
    const once = updateDeadBoards({}, [notFound], AFTERNOON)

    expect(isDead(updateDeadBoards(once, [notFound], hoursLater(3)), { ats: "lever", slug: "plaid" })).toBe(false)
  })

  test("calls the board dead after a second 404 at least 20 hours later", () => {
    const once = updateDeadBoards({}, [notFound], AFTERNOON)

    expect(isDead(updateDeadBoards(once, [notFound], hoursLater(20)), { ats: "lever", slug: "plaid" })).toBe(true)
  })

  test("forgets the 404 once the board works again", () => {
    const once = updateDeadBoards({}, [notFound], AFTERNOON)

    expect(updateDeadBoards(once, [worked], hoursLater(24))).toEqual({})
  })

  test("ignores failures that are not 404, such as a busy server", () => {
    expect(updateDeadBoards({}, [busy], AFTERNOON)).toEqual({})
  })

  test("keeps entries for boards that were not in this run", () => {
    const earlier = { "greenhouse:gone": { first404: "2026-10-01T10:00:00.000Z", last404: "2026-10-02T10:00:00.000Z" } }

    expect(updateDeadBoards(earlier, [worked], AFTERNOON)).toEqual(earlier)
  })

  test("keeps a Lever EU board's 404s apart from the US board with the same slug", () => {
    const euGone: BoardResult = { ...notFound, region: "eu" }
    const dead = updateDeadBoards(updateDeadBoards({}, [euGone], AFTERNOON), [euGone], hoursLater(20))

    expect(Object.keys(dead)).toEqual(["lever-eu:plaid"])
    expect(isDead(dead, { ats: "lever", slug: "plaid", region: "eu" })).toBe(true)
    expect(isDead(dead, { ats: "lever", slug: "plaid" })).toBe(false)
  })
})

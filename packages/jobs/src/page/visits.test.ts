// Tests that nextVisits remembers when the user last opened the feed, so the page can mark what is new since then.
import { describe, expect, test } from "vitest"
import { nextVisits } from "./visits"

const NOW = "2026-11-05T18:00:00.000Z"

describe("nextVisits", () => {
  test("starts a first visit with nothing earlier to compare against", () => {
    expect(nextVisits(undefined, NOW)).toEqual({ current: NOW })
  })

  test("keeps the same visit when the page is reloaded within half an hour", () => {
    const stored = { current: "2026-11-05T17:45:00.000Z", previous: "2026-11-04T09:00:00.000Z" }

    expect(nextVisits(stored, NOW)).toEqual(stored)
  })

  test("makes the last visit the earlier one when the page opens again later", () => {
    const stored = { current: "2026-11-05T09:00:00.000Z", previous: "2026-11-04T09:00:00.000Z" }

    expect(nextVisits(stored, NOW)).toEqual({ current: NOW, previous: "2026-11-05T09:00:00.000Z" })
  })
})

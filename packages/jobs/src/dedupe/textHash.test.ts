// Tests that textHash gives copies of a posting the same hash while real differences in the text change it.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import type { JobRecord } from "../types"
import { textHash } from "./textHash"

const [spacexRedmond, spacexBastrop, tsmgRouen, tsmgBordeaux, deepgramUs, deepgramSingapore] = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../test/fixtures/repeat-postings.json"), "utf8"),
) as JobRecord[]

describe("textHash", () => {
  test("matches copies whose text differs only in the job's own city", () => {
    expect(textHash(tsmgRouen!)).toBe(textHash(tsmgBordeaux!))
  })

  test("tells apart copies where one adds a sentence", () => {
    expect(textHash(deepgramUs!)).not.toBe(textHash(deepgramSingapore!))
  })

  test("tells apart copies where one has a pay range and the other does not", () => {
    expect(textHash(spacexRedmond!)).not.toBe(textHash(spacexBastrop!))
  })

  test("ignores dates, which change when a posting is copied or refreshed", () => {
    const first = { ...tsmgRouen!, description: "Posted 2026-10-01, updated 10/03/2026. Collect map data." }
    const second = { ...tsmgRouen!, description: "Posted 2026-11-03, updated 11/04/2026. Collect map data." }

    expect(textHash(first)).toBe(textHash(second))
  })

  test("keeps other numbers, so openings with different pay or experience stay apart", () => {
    const junior = { ...tsmgRouen!, description: "2+ years of experience. Pay $101,000 to $135,000." }
    const senior = { ...tsmgRouen!, description: "5+ years of experience. Pay $132,000 to $175,000." }

    expect(textHash(junior)).not.toBe(textHash(senior))
  })

  test("ignores punctuation, so copies that differ by a colon match", () => {
    const first = { ...tsmgRouen!, description: "Job Qualifications\nFamiliarity with R, Python." }
    const second = { ...tsmgRouen!, description: "Job Qualifications:\nFamiliarity with R, Python" }

    expect(textHash(first)).toBe(textHash(second))
  })

  test("still tells pay ranges apart after taking out punctuation", () => {
    const low = { ...tsmgRouen!, description: "Pay $101,000 to $135,000." }
    const high = { ...tsmgRouen!, description: "Pay $132,000 to $175,000." }

    expect(textHash(low)).not.toBe(textHash(high))
  })

  test("ignores case and spacing in the title", () => {
    expect(textHash({ ...tsmgRouen!, title: "Surveyor/Field  Data analyst " })).toBe(textHash(tsmgRouen!))
  })

  test("never matches the same text on two different boards", () => {
    expect(textHash({ ...tsmgRouen!, slug: "another-company" })).not.toBe(textHash(tsmgRouen!))
  })
})

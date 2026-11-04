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

  test("ignores numbers such as dates and requisition ids", () => {
    const first = { ...tsmgRouen!, description: "Posted 2026-10-01. Req R12345. Collect map data." }
    const second = { ...tsmgRouen!, description: "Posted 2026-11-03. Req R67890. Collect map data." }

    expect(textHash(first)).toBe(textHash(second))
  })

  test("ignores case and spacing in the title", () => {
    expect(textHash({ ...tsmgRouen!, title: "Surveyor/Field  Data analyst " })).toBe(textHash(tsmgRouen!))
  })

  test("never matches the same text on two different boards", () => {
    expect(textHash({ ...tsmgRouen!, slug: "another-company" })).not.toBe(textHash(tsmgRouen!))
  })
})

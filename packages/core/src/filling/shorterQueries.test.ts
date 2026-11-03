// Tests the list of shorter searches tried after a dropdown found nothing for the full text.
import { describe, expect, test } from "vitest"
import { shorterQueries } from "./shorterQueries"

describe("shorterQueries", () => {
  test("drops the last word each time, down to the first word", () => {
    expect(shorterQueries("Indiana University Bloomington")).toEqual(["Indiana University", "Indiana"])
  })

  test("gives one shorter search for a two-word text", () => {
    expect(shorterQueries("PES University")).toEqual(["PES"])
  })

  test("gives none for a single word", () => {
    expect(shorterQueries("Stanford")).toEqual([])
  })

  test("skips searches that are too short to mean anything", () => {
    expect(shorterQueries("IU Bloomington Campus")).toEqual(["IU Bloomington"])
  })

  test("ignores extra spacing", () => {
    expect(shorterQueries("  Indiana   University  ")).toEqual(["Indiana"])
  })

  test("gives none for an empty text", () => {
    expect(shorterQueries("   ")).toEqual([])
  })
})

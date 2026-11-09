// Tests that the readers stay at least as good as their measured score on the hand-labelled postings in test/fixtures.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { LABELLED_USER } from "../commands/labelled"
import { scoreLabels, type LabelledJob } from "./scoreLabels"

const JOBS = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/labelled-jobs.json"), "utf8")) as LabelledJob[]
const REPORT = scoreLabels(JOBS, LABELLED_USER)

describe("the labelled set", () => {
  test("holds 200 postings, each with every label", () => {
    expect(JOBS).toHaveLength(200)
    expect(JOBS.every(({ labels }) => ["restrictions", "years", "degree", "pay", "abroad"].every((name) => name in labels))).toBe(true)
  })

  test.each([
    ["tags", 183],
    ["years", 189],
    ["degree", 169],
    ["pay", 182],
    ["abroad", 196],
  ] as const)("reads %s right at least %i times", (field, floor) => {
    expect(REPORT.fields[field].right).toBeGreaterThanOrEqual(floor)
  })

  test("decides hide or show right at least 177 times", () => {
    expect(REPORT.hide.right).toBeGreaterThanOrEqual(177)
  })
})

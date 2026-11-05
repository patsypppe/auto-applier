// Tests that normalizeName writes company names the same way whether they come from a job board or a USCIS filing.
import { describe, expect, test } from "vitest"
import { normalizeName } from "./normalizeName"

describe("normalizeName", () => {
  test.each([
    ["STRIPE LLC", "stripe"],
    ["Stripe, Inc.", "stripe"],
    ["ANTHROPIC PBC", "anthropic"],
    ["Procter & Gamble Co", "procter and gamble"],
    ["Alarm.com", "alarm com"],
    ["  Notion   Labs Inc ", "notion labs"],
    ["DATABRICKS INC", "databricks"],
  ])("writes %s as %s", (name, normalized) => {
    expect(normalizeName(name)).toBe(normalized)
  })

  test("removes only endings, so a name that is all endings keeps its words", () => {
    expect(normalizeName("Company Inc")).toBe("company")
  })
})

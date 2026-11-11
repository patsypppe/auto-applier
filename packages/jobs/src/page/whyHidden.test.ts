// Tests that whyHidden gives every hide reason a sentence that names the value used and the chip or setting it came from.
import { describe, expect, test } from "vitest"
import { HIDE_REASONS } from "../feed/applyFilters"
import { parseSettings } from "../settings"
import { whyHidden } from "./whyHidden"

const FILTERS = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"], locations: ["Austin"], myDegree: "master", minScore: 40 } }).filters

describe("whyHidden", () => {
  test("has its own sentence for every hide reason", () => {
    const sentences = HIDE_REASONS.map((reason) => whyHidden(reason, FILTERS, {}))

    for (const sentence of sentences) expect(sentence).toMatch(/^Hidden because .+\. Set by .+\.$/)
    expect(new Set(sentences).size).toBe(HIDE_REASONS.length)
  })

  test("names the chip when a chip set the value, and the settings otherwise", () => {
    expect(whyHidden("old", { ...FILTERS, postedWithinDays: 7 }, { within: "7" })).toBe("Hidden because it was posted more than 7 days ago. Set by the Posted chip.")
    expect(whyHidden("old", FILTERS, {})).toBe("Hidden because it was posted more than 90 days ago. Set by Posted within in the settings panel.")
  })

  test("writes the values in use: years, pay, degree, roles and places", () => {
    expect(whyHidden("experience", FILTERS, {})).toBe("Hidden because it asks for more than 2 years of experience. Set by Most years of experience asked in the settings panel.")
    expect(whyHidden("pay", { ...FILTERS, minYearlyPay: 80000 }, { minPay: "80000" })).toBe("Hidden because it pays less than $80,000 a year. Set by the Pay chip.")
    expect(whyHidden("degree", FILTERS, {})).toBe("Hidden because it asks for a higher degree than your master's. Set by My highest degree in the settings panel.")
    expect(whyHidden("role", FILTERS, {})).toBe("Hidden because its title matches none of your roles (data analyst). Set by Roles in the settings panel.")
    expect(whyHidden("location", FILTERS, {})).toBe("Hidden because none of its places match Austin. Set by Places in the settings panel.")
  })

  test("returns nothing for a reason it does not know", () => {
    expect(whyHidden("gone", FILTERS, {})).toBeUndefined()
  })
})

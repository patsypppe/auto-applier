// Tests that findChoice picks the one choice that matches a value, and refuses to guess when unsure.
import { describe, expect, test } from "vitest"
import { findChoice } from "./findChoice"

const text = (choice: string) => choice

describe("findChoice", () => {
  test("finds an exact match, ignoring case, spacing and punctuation", () => {
    expect(findChoice("United States", ["Canada", "united  states"], text)).toBe("united  states")
    expect(findChoice("Yes", ["Yes.", "No."], text)).toBe("Yes.")
  })

  test("prefers an exact match over a longer one that contains it", () => {
    expect(findChoice("No", ["No preference", "No"], text)).toBe("No")
  })

  test("matches when the choice starts with the value as whole words", () => {
    expect(findChoice("Yes", ["Yes, I am authorized", "No, I am not"], text)).toBe("Yes, I am authorized")
  })

  test("matches when the value appears as whole words inside the choice", () => {
    expect(findChoice("Citizen", ["Permanent Resident", "U.S. Citizen"], text)).toBe("U.S. Citizen")
  })

  test("does not match inside a longer word", () => {
    expect(findChoice("No", ["Not sure", "Norway"], text)).toBeUndefined()
  })

  test("refuses to guess when more than one choice fits", () => {
    expect(findChoice("Yes", ["Yes, with sponsorship", "Yes, without sponsorship"], text)).toBeUndefined()
  })

  test("returns undefined when nothing matches", () => {
    expect(findChoice("Maybe", ["Yes", "No"], text)).toBeUndefined()
  })

  test("returns undefined for an empty value", () => {
    expect(findChoice("  ", ["Yes", "No"], text)).toBeUndefined()
    expect(findChoice("...", ["Yes", "No"], text)).toBeUndefined()
  })

  test("returns undefined when there are no choices", () => {
    expect(findChoice("Yes", [], text)).toBeUndefined()
  })

  test("works with any kind of choice by reading its text", () => {
    const choices = [{ label: "Canada" }, { label: "United States" }]

    expect(findChoice("canada", choices, (choice) => choice.label)).toBe(choices[0])
  })

  test("handles letters outside plain English", () => {
    expect(findChoice("São Paulo", ["Rio", "São Paulo"], text)).toBe("São Paulo")
  })
})

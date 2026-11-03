// Tests that long free-text questions are told apart from short ordinary fields.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import { makeField } from "../testing/makeField"
import { isFreeTextQuestion } from "./isFreeTextQuestion"

// Builds a text field backed by a textarea instead of an input.
function textareaField(label: string): FormField {
  return { ...makeField({ label, kind: "text" }), element: document.createElement("textarea") }
}

describe("isFreeTextQuestion", () => {
  test("treats any textarea as a free-text question", () => {
    expect(isFreeTextQuestion(textareaField("Cover letter"))).toBe(true)
  })

  test("treats a text input whose label is a question as one", () => {
    expect(isFreeTextQuestion(makeField({ label: "Why us?", kind: "text" }))).toBe(true)
  })

  test("treats a text input with a long label as one", () => {
    expect(isFreeTextQuestion(makeField({ label: "Describe a project you are proud of", kind: "text" }))).toBe(true)
  })

  test("does not treat short ordinary fields as questions", () => {
    expect(isFreeTextQuestion(makeField({ label: "Referral code", kind: "text" }))).toBe(false)
    expect(isFreeTextQuestion(makeField({ label: "City", kind: "text" }))).toBe(false)
    expect(isFreeTextQuestion(makeField({ label: "", name: "x", kind: "text" }))).toBe(false)
  })

  test("never treats choice fields as free-text questions", () => {
    expect(isFreeTextQuestion(makeField({ label: "Why do you want to work here at this company?", kind: "select" }))).toBe(
      false,
    )
    expect(isFreeTextQuestion(makeField({ label: "Are you ready to start?", kind: "radio" }))).toBe(false)
  })
})

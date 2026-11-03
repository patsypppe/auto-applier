// Tests the prompt that picks the option matching a known answer, and the checks on what the model picked.
import { describe, expect, test } from "vitest"
import { buildPickOptionsPrompt, parsePickedOptions } from "./pickOptionsPrompt"
import type { PickItem } from "./pickOptionsPrompt"

const ITEMS: PickItem[] = [
  {
    id: 0,
    question: "Do you require visa sponsorship?",
    options: ["I require sponsorship", "I do not require sponsorship"],
    answer: "No",
  },
  { id: 1, question: "Work authorization", options: ["US Citizen", "Visa holder"], answer: "Citizen" },
]

describe("buildPickOptionsPrompt", () => {
  const prompt = buildPickOptionsPrompt(ITEMS)

  test("includes each question, its options and the known answer", () => {
    expect(prompt).toContain("Do you require visa sponsorship?")
    expect(prompt).toContain("I do not require sponsorship")
    expect(prompt).toContain('"answer": "No"')
    expect(prompt).toContain('"answer": "Citizen"')
  })

  test("tells the model to copy an option exactly or say none", () => {
    expect(prompt).toContain('"none"')
    expect(prompt).toMatch(/exactly/i)
  })

  test("marks the form text as untrusted", () => {
    expect(prompt).toMatch(/untrusted/i)
  })
})

describe("parsePickedOptions", () => {
  test("returns the option the model chose for each question", () => {
    const answer = {
      choices: [
        { id: 0, option: "I do not require sponsorship" },
        { id: 1, option: "US Citizen" },
      ],
    }

    expect(parsePickedOptions(answer, ITEMS)).toEqual(
      new Map([
        [0, "I do not require sponsorship"],
        [1, "US Citizen"],
      ]),
    )
  })

  test("returns the option as written on the form even if the model changed its case or spacing", () => {
    const answer = { choices: [{ id: 0, option: "  i do not require SPONSORSHIP " }] }

    expect(parsePickedOptions(answer, ITEMS).get(0)).toBe("I do not require sponsorship")
  })

  test("drops none, options that were not offered and ids out of range", () => {
    const answer = {
      choices: [
        { id: 0, option: "none" },
        { id: 1, option: "Green card holder" },
        { id: 9, option: "US Citizen" },
      ],
    }

    expect(parsePickedOptions(answer, ITEMS).size).toBe(0)
  })

  test.each([["a string", "no"], ["null", null], ["a missing list", {}], ["wrong entries", { choices: ["x"] }]])(
    "rejects an answer that is %s",
    (_name, answer) => {
      expect(() => parsePickedOptions(answer, ITEMS)).toThrow("did not match the expected format")
    },
  )
})

// Tests the prompt that asks which profile key each unrecognised field wants, and the checks on the answer.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { PROFILE_KEYS } from "../profile/keys"
import { makeField } from "../testing/makeField"
import { buildMapFieldsPrompt, parseMapFieldsAnswer } from "./mapFieldsPrompt"

const FIELDS = [
  makeField({ label: "Contact number", name: "contact", kind: "text" }),
  makeField({ label: "Country", kind: "select", options: ["United States", "Canada"] }),
]

describe("buildMapFieldsPrompt", () => {
  test("describes each field with an id, label, kind and name", () => {
    const prompt = buildMapFieldsPrompt(FIELDS)

    expect(prompt).toContain('"id": 0')
    expect(prompt).toContain('"label": "Contact number"')
    expect(prompt).toContain('"name": "contact"')
    expect(prompt).toContain('"id": 1')
    expect(prompt).toContain('"kind": "select"')
  })

  test("includes the options of choice fields", () => {
    const prompt = buildMapFieldsPrompt(FIELDS)

    expect(prompt).toContain('"United States"')
    expect(prompt).toContain('"Canada"')
  })

  test("leaves out the name and options when a field has none", () => {
    const prompt = buildMapFieldsPrompt([makeField({ label: "Contact number", kind: "text" })])

    expect(prompt).not.toContain('"name"')
    expect(prompt).not.toContain('"options"')
  })

  test("lists every profile key with its meaning, and allows none", () => {
    const prompt = buildMapFieldsPrompt(FIELDS)

    for (const key of PROFILE_KEYS) expect(prompt).toContain(`- ${key}:`)
    expect(prompt).toContain('"none"')
  })

  test("marks the form text as untrusted", () => {
    expect(buildMapFieldsPrompt(FIELDS)).toMatch(/untrusted/i)
  })

  test("sends only the first options of a very long list, each shortened", () => {
    const options = Array.from({ length: 40 }, (_unused, index) => `Option ${index} ${"x".repeat(200)}`)

    const prompt = buildMapFieldsPrompt([makeField({ label: "Pick", kind: "select", options })])

    expect(prompt).toContain("Option 29")
    expect(prompt).not.toContain("Option 30")
    expect(prompt).not.toContain("x".repeat(100))
  })
})

describe("parseMapFieldsAnswer", () => {
  test("returns the key chosen for each field id", () => {
    const answer = {
      matches: [
        { id: 0, key: "phone" },
        { id: 1, key: "workAuthorization" },
      ],
    }

    expect(parseMapFieldsAnswer(answer, 2)).toEqual(
      new Map([
        [0, "phone"],
        [1, "workAuthorization"],
      ]),
    )
  })

  test("drops none, keys that do not exist and ids that are out of range", () => {
    const answer = {
      matches: [
        { id: 0, key: "none" },
        { id: 1, key: "favouriteColour" },
        { id: 7, key: "phone" },
        { id: -1, key: "email" },
        { id: 1.5, key: "email" },
        { id: 2, key: "email" },
      ],
    }

    expect(parseMapFieldsAnswer(answer, 3)).toEqual(new Map([[2, "email"]]))
  })

  test("keeps the first answer when an id appears twice", () => {
    const answer = {
      matches: [
        { id: 0, key: "phone" },
        { id: 0, key: "email" },
      ],
    }

    expect(parseMapFieldsAnswer(answer, 1).get(0)).toBe("phone")
  })

  test("accepts an empty list of matches", () => {
    expect(parseMapFieldsAnswer({ matches: [] }, 2).size).toBe(0)
  })

  test.each([["a string", "no"], ["null", null], ["a list", []], ["a missing list", {}], ["wrong entries", { matches: [1, 2] }]])(
    "rejects an answer that is %s",
    (_name, answer) => {
      expect(() => parseMapFieldsAnswer(answer, 2)).toThrow("did not match the expected format")
    },
  )
})

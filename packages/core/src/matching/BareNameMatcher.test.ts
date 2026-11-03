// Tests that a bare "Name" field maps to the full name only when the page has no split name fields.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { BareNameMatcher } from "./BareNameMatcher"
import { CONFIDENCE } from "./constants"
import { makeField } from "../testing/makeField"

describe("BareNameMatcher", () => {
  test("maps a lone 'Name' field to the full name", () => {
    const name = makeField({ label: "Name" })

    const result = new BareNameMatcher([name]).match(name)

    expect(result).toEqual({ profileKey: "fullName", confidence: CONFIDENCE.label })
  })

  test.each(["Your name", "Applicant name", "Candidate name"])("maps the label %s to the full name", (label) => {
    const name = makeField({ label })

    expect(new BareNameMatcher([name]).match(name)?.profileKey).toBe("fullName")
  })

  test("stays out of the way when the page has a first name field", () => {
    const name = makeField({ label: "Name" })
    const first = makeField({ label: "First name" })

    expect(new BareNameMatcher([name, first]).match(name)).toBeNull()
  })

  test("stays out of the way when the page has only a last name field", () => {
    const name = makeField({ label: "Name" })
    const last = makeField({ label: "Last name" })

    expect(new BareNameMatcher([name, last]).match(name)).toBeNull()
  })

  test("notices split name fields identified by autocomplete", () => {
    const name = makeField({ label: "Name" })
    const given = makeField({ autocomplete: "given-name" })

    expect(new BareNameMatcher([name, given]).match(name)).toBeNull()
  })

  test("does not match labels that only contain the word name", () => {
    const company = makeField({ label: "Company name" })

    expect(new BareNameMatcher([company]).match(company)).toBeNull()
  })

  test("leaves 'Full name' to the attribute matcher", () => {
    const full = makeField({ label: "Full name" })

    expect(new BareNameMatcher([full]).match(full)).toBeNull()
  })

  test("uses a name attribute of 'name' when the field has no label", () => {
    const unlabelled = makeField({ name: "name" })

    const result = new BareNameMatcher([unlabelled]).match(unlabelled)

    expect(result).toEqual({ profileKey: "fullName", confidence: CONFIDENCE.name })
  })

  test("ignores a name attribute of 'name' when the label says something else", () => {
    const company = makeField({ label: "Company name", name: "name" })

    expect(new BareNameMatcher([company]).match(company)).toBeNull()
  })

  test("only matches text fields", () => {
    const select = makeField({ label: "Name", kind: "select" })

    expect(new BareNameMatcher([select]).match(select)).toBeNull()
  })
})

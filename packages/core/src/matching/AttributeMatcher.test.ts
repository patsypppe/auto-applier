// Tests that AttributeMatcher maps fields to profile keys from autocomplete, label and name.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { AttributeMatcher } from "./AttributeMatcher"
import { CONFIDENCE } from "./constants"
import { makeField } from "../testing/makeField"

const matcher = new AttributeMatcher()

describe("AttributeMatcher: autocomplete", () => {
  test.each([
    ["given-name", "firstName"],
    ["family-name", "lastName"],
    ["additional-name", "middleName"],
    ["name", "fullName"],
    ["email", "email"],
    ["tel", "phone"],
  ])("maps autocomplete %s to %s with high confidence", (autocomplete, profileKey) => {
    expect(matcher.match(makeField({ autocomplete }))).toEqual({
      profileKey,
      confidence: CONFIDENCE.autocomplete,
    })
  })

  test("uses the last token when autocomplete has section tokens", () => {
    expect(matcher.match(makeField({ autocomplete: "section-work given-name" }))?.profileKey).toBe("firstName")
  })

  test("ignores autocomplete values it does not know", () => {
    expect(matcher.match(makeField({ autocomplete: "off" }))).toBeNull()
  })

  test("prefers autocomplete over the label", () => {
    const result = matcher.match(makeField({ autocomplete: "email", label: "First name" }))

    expect(result?.profileKey).toBe("email")
  })
})

describe("AttributeMatcher: label", () => {
  test.each([
    ["First name", "firstName"],
    ["Given name", "firstName"],
    ["Last name", "lastName"],
    ["Surname", "lastName"],
    ["Middle initial", "middleName"],
    ["Full name", "fullName"],
    ["Legal name", "legalName"],
    ["Preferred name", "preferredName"],
    ["Email address", "email"],
    ["E-mail", "email"],
    ["Mobile phone", "phone"],
    ["LinkedIn profile", "linkedin"],
    ["GitHub", "github"],
    ["Portfolio URL", "portfolio"],
    ["Website", "portfolio"],
    ["Skills", "skills"],
    ["Work authorization", "workAuthorization"],
    ["Are you legally authorized to work in the United States?", "isAuthorizedToWork"],
    ["Are you eligible to work in the US?", "isAuthorizedToWork"],
    ["Do you have the right to work in the UK?", "isAuthorizedToWork"],
    ["Are you authorized to work here without sponsorship?", "isAuthorizedToWork"],
    ["Do you require visa sponsorship?", "needsSponsorship"],
    ["Notice period", "noticePeriod"],
    ["Salary expectations", "salaryExpectation"],
  ])("maps the label %s to %s", (label, profileKey) => {
    expect(matcher.match(makeField({ label }))).toEqual({ profileKey, confidence: CONFIDENCE.label })
  })

  test("is not case sensitive", () => {
    expect(matcher.match(makeField({ label: "FIRST NAME" }))?.profileKey).toBe("firstName")
  })

  test("checks the specific name before the generic one", () => {
    expect(matcher.match(makeField({ label: "Legal name" }))?.profileKey).toBe("legalName")
    expect(matcher.match(makeField({ label: "Preferred name" }))?.profileKey).toBe("preferredName")
  })

  test("does not match a plain 'Name' or 'Company name'", () => {
    expect(matcher.match(makeField({ label: "Name" }))).toBeNull()
    expect(matcher.match(makeField({ label: "Company name" }))).toBeNull()
  })

  test("does not match a question it has no rule for", () => {
    expect(matcher.match(makeField({ label: "Why do you want to work here?" }))).toBeNull()
  })
})

describe("AttributeMatcher: name attribute", () => {
  test.each([
    ["first_name", "firstName"],
    ["firstName", "firstName"],
    ["applicant[last_name]", "lastName"],
    ["email", "email"],
    ["phone_number", "phone"],
    ["linkedin_url", "linkedin"],
  ])("maps the name %s to %s with lower confidence than a label", (name, profileKey) => {
    expect(matcher.match(makeField({ name }))).toEqual({ profileKey, confidence: CONFIDENCE.name })
  })

  test("prefers the label over the name", () => {
    const result = matcher.match(makeField({ label: "Email", name: "first_name" }))

    expect(result).toEqual({ profileKey: "email", confidence: CONFIDENCE.label })
  })

  test("returns null when the label and name are both empty", () => {
    expect(matcher.match(makeField())).toBeNull()
  })

  test("returns null for a name it does not recognise", () => {
    expect(matcher.match(makeField({ name: "input-23" }))).toBeNull()
  })
})

describe("AttributeMatcher: field kinds", () => {
  test("does not match a select labelled 'Phone type' to the phone number", () => {
    expect(matcher.match(makeField({ label: "Phone type", kind: "select" }))).toBeNull()
  })

  test("still matches choice fields for keys that allow them", () => {
    const result = matcher.match(makeField({ label: "Notice period", kind: "select" }))

    expect(result?.profileKey).toBe("noticePeriod")
  })

  test("matches skills for a text input or a combobox", () => {
    expect(matcher.match(makeField({ label: "Skills", kind: "combobox" }))?.profileKey).toBe("skills")
  })
})

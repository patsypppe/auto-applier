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
    ["Current or previous employer", "currentCompany"],
    ["Current company", "currentCompany"],
    ["Most recent employer", "currentCompany"],
    ["Employer", "currentCompany"],
    ["Current or previous job title", "currentTitle"],
    ["Current job title", "currentTitle"],
    ["Job title", "currentTitle"],
    ["Most recent position", "currentTitle"],
    ["School", "school"],
    ["University", "school"],
    ["School or university", "school"],
    ["Degree", "degree"],
    ["Field of study", "fieldOfStudy"],
    ["Major", "fieldOfStudy"],
    ["City", "city"],
    ["Location (City)", "city"],
    ["State", "state"],
    ["State / Province", "state"],
    ["Country", "country"],
    ["Please select the country where you currently reside", "country"],
    ["Country of residence", "country"],
    ["City and state of residence", "location"],
    ["If in the US, please enter your city and state of residence", "location"],
    ["Location", "location"],
    ["Current location", "location"],
    ["Where are you based?", "location"],
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

describe("AttributeMatcher: work and education history", () => {
  test.each([
    ["current_company", "currentCompany"],
    ["employer", "currentCompany"],
    ["job_title", "currentTitle"],
    ["school", "school"],
    ["degree", "degree"],
    ["field_of_study", "fieldOfStudy"],
  ])("maps the name attribute %s to %s", (name, profileKey) => {
    expect(matcher.match(makeField({ name }))).toEqual({ profileKey, confidence: CONFIDENCE.name })
  })

  test("does not treat questions that merely mention employment as the employer field", () => {
    expect(matcher.match(makeField({ label: "Have you ever been employed by Stripe or a Stripe affiliate?" }))).toBeNull()
    expect(matcher.match(makeField({ label: "Are you currently employed?" }))).toBeNull()
  })

  test("does not treat a bare title or position as the job title", () => {
    expect(matcher.match(makeField({ label: "Title" }))).toBeNull()
    expect(matcher.match(makeField({ label: "Position you are applying for" }))).toBeNull()
  })

  test("matches school and degree for a text input, a combobox or a select", () => {
    for (const kind of ["text", "combobox", "select"] as const) {
      expect(matcher.match(makeField({ label: "School", kind }))?.profileKey).toBe("school")
      expect(matcher.match(makeField({ label: "Degree", kind }))?.profileKey).toBe("degree")
    }
  })

  test("does not match school or degree for a radio group or checkbox", () => {
    expect(matcher.match(makeField({ label: "Degree", kind: "radio" }))).toBeNull()
    expect(matcher.match(makeField({ label: "School", kind: "checkbox" }))).toBeNull()
  })

  test("does not match the employer for a select", () => {
    expect(matcher.match(makeField({ label: "Current employer", kind: "select" }))).toBeNull()
  })
})

describe("AttributeMatcher: location", () => {
  test.each([
    ["address-level2", "city"],
    ["address-level1", "state"],
    ["country", "country"],
    ["country-name", "country"],
  ])("maps autocomplete %s to %s", (autocomplete, profileKey) => {
    expect(matcher.match(makeField({ autocomplete }))).toEqual({ profileKey, confidence: CONFIDENCE.autocomplete })
  })

  test.each([
    ["city", "city"],
    ["state", "state"],
    ["country", "country"],
    ["location", "location"],
  ])("maps the name attribute %s to %s", (name, profileKey) => {
    expect(matcher.match(makeField({ name }))).toEqual({ profileKey, confidence: CONFIDENCE.name })
  })

  test("does not mistake the verb 'state' for the state field", () => {
    expect(matcher.match(makeField({ label: "Please state your notice period" }))?.profileKey).toBe("noticePeriod")
    expect(matcher.match(makeField({ label: "State your salary expectations" }))?.profileKey).toBe("salaryExpectation")
  })

  test("does not match the plural 'states' or 'countries'", () => {
    expect(matcher.match(makeField({ label: "Are you authorized to work in the United States?" }))?.profileKey).toBe(
      "isAuthorizedToWork",
    )
    expect(matcher.match(makeField({ label: "Countries you anticipate working in" }))).toBeNull()
  })

  test("does not treat a phone country code or country of citizenship as the country", () => {
    expect(matcher.match(makeField({ label: "Phone country code", kind: "select" }))).toBeNull()
    expect(matcher.match(makeField({ label: "Country of citizenship" }))).toBeNull()
    expect(matcher.match(makeField({ label: "Country of birth" }))).toBeNull()
  })

  test("does not treat a preference or office location as the home location", () => {
    expect(matcher.match(makeField({ label: "Preferred work location" }))).toBeNull()
    expect(matcher.match(makeField({ label: "Office location", kind: "select" }))).toBeNull()
  })

  test("matches city, state and country for a text input, a combobox or a select, but the location only for text or a combobox", () => {
    for (const kind of ["text", "combobox", "select"] as const) {
      expect(matcher.match(makeField({ label: "Country", kind }))?.profileKey).toBe("country")
      expect(matcher.match(makeField({ label: "State", kind }))?.profileKey).toBe("state")
    }
    expect(matcher.match(makeField({ label: "Location", kind: "combobox" }))?.profileKey).toBe("location")
    expect(matcher.match(makeField({ label: "Location", kind: "select" }))).toBeNull()
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

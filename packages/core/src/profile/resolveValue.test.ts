// Tests that each profile key resolves to the right text, including derived and missing values.
import { describe, expect, test } from "vitest"
import { PROFILE_KEYS } from "./keys"
import { resolveValue } from "./resolveValue"
import type { Profile } from "./types"

const completeProfile: Profile = {
  personal: {
    firstName: "Pranav",
    middleName: "T",
    lastName: "Pattanashetty",
    legalName: "Pranav Tukaram Pattanashetty",
    preferredName: "Pran",
    email: "pranav@example.com",
    phone: "5551234567",
    links: { linkedin: "linkedin.com/in/pranav", github: "github.com/pranav", portfolio: "pranav.dev" },
  },
  experience: [],
  education: [],
  skills: ["TypeScript", "React"],
  answers: {
    workAuthorization: "Citizen",
    needsSponsorship: false,
    isAuthorizedToWork: true,
    noticePeriod: "2 weeks",
    salaryExpectation: "120000",
  },
}

const minimalProfile: Profile = {
  personal: {
    firstName: "Pranav",
    lastName: "Pattanashetty",
    email: "pranav@example.com",
    phone: "5551234567",
    links: {},
  },
  experience: [],
  education: [],
  skills: [],
  answers: { workAuthorization: "Citizen", needsSponsorship: true, isAuthorizedToWork: false },
}

describe("resolveValue", () => {
  test("returns stored personal values as they are", () => {
    expect(resolveValue(completeProfile, "firstName")).toBe("Pranav")
    expect(resolveValue(completeProfile, "email")).toBe("pranav@example.com")
    expect(resolveValue(completeProfile, "github")).toBe("github.com/pranav")
  })

  test("returns stored answers as they are", () => {
    expect(resolveValue(completeProfile, "workAuthorization")).toBe("Citizen")
    expect(resolveValue(completeProfile, "noticePeriod")).toBe("2 weeks")
  })

  test("derives the full name from the name parts", () => {
    expect(resolveValue(completeProfile, "fullName")).toBe("Pranav T Pattanashetty")
  })

  test("uses the legal and preferred name overrides when set", () => {
    expect(resolveValue(completeProfile, "legalName")).toBe("Pranav Tukaram Pattanashetty")
    expect(resolveValue(completeProfile, "preferredName")).toBe("Pran")
  })

  test("falls back to the full name and first name when there are no overrides", () => {
    expect(resolveValue(minimalProfile, "legalName")).toBe("Pranav Pattanashetty")
    expect(resolveValue(minimalProfile, "preferredName")).toBe("Pranav")
  })

  test("turns the sponsorship boolean into Yes or No", () => {
    expect(resolveValue(minimalProfile, "needsSponsorship")).toBe("Yes")
    expect(resolveValue(completeProfile, "needsSponsorship")).toBe("No")
  })

  test("turns the authorized-to-work boolean into Yes or No", () => {
    expect(resolveValue(completeProfile, "isAuthorizedToWork")).toBe("Yes")
    expect(resolveValue(minimalProfile, "isAuthorizedToWork")).toBe("No")
  })

  test("joins skills with commas", () => {
    expect(resolveValue(completeProfile, "skills")).toBe("TypeScript, React")
  })

  test("returns undefined for optional values that are not set", () => {
    expect(resolveValue(minimalProfile, "middleName")).toBeUndefined()
    expect(resolveValue(minimalProfile, "linkedin")).toBeUndefined()
    expect(resolveValue(minimalProfile, "salaryExpectation")).toBeUndefined()
  })

  test("returns undefined when there are no skills", () => {
    expect(resolveValue(minimalProfile, "skills")).toBeUndefined()
  })

  test("resolves every known key to text for a complete profile", () => {
    for (const key of PROFILE_KEYS) {
      expect(resolveValue(completeProfile, key), key).toEqual(expect.any(String))
    }
  })
})

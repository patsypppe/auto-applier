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
    city: "San Francisco",
    state: "California",
    country: "United States",
    links: { linkedin: "linkedin.com/in/pranav", github: "github.com/pranav", portfolio: "pranav.dev" },
  },
  experience: [
    { company: "Acme", title: "Backend Engineer", startDate: "2022", description: "" },
    { company: "Old Co", title: "Intern", startDate: "2020", endDate: "2021", description: "" },
  ],
  education: [{ school: "State University", degree: "BSc", field: "Computer Science", startDate: "2018", endDate: "2022" }],
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

  test("takes the employer and job title from the current job", () => {
    expect(resolveValue(completeProfile, "currentCompany")).toBe("Acme")
    expect(resolveValue(completeProfile, "currentTitle")).toBe("Backend Engineer")
  })

  test("takes the school, degree and field of study from the current education", () => {
    expect(resolveValue(completeProfile, "school")).toBe("State University")
    expect(resolveValue(completeProfile, "degree")).toBe("BSc")
    expect(resolveValue(completeProfile, "fieldOfStudy")).toBe("Computer Science")
  })

  test("returns undefined for history values when there is no history", () => {
    for (const key of ["currentCompany", "currentTitle", "school", "degree", "fieldOfStudy"] as const) {
      expect(resolveValue(minimalProfile, key), key).toBeUndefined()
    }
  })

  test("returns undefined for the field of study when the degree has none", () => {
    const noField = {
      ...completeProfile,
      education: [{ school: "State University", degree: "BSc", startDate: "2018" }],
    }

    expect(resolveValue(noField, "fieldOfStudy")).toBeUndefined()
    expect(resolveValue(noField, "degree")).toBe("BSc")
  })

  test("returns the stored city, state and country", () => {
    expect(resolveValue(completeProfile, "city")).toBe("San Francisco")
    expect(resolveValue(completeProfile, "state")).toBe("California")
    expect(resolveValue(completeProfile, "country")).toBe("United States")
  })

  test("derives the location from the city, state and country", () => {
    expect(resolveValue(completeProfile, "location")).toBe("San Francisco, California, United States")
  })

  test("returns undefined for location values the profile does not have", () => {
    for (const key of ["city", "state", "country", "location"] as const) {
      expect(resolveValue(minimalProfile, key), key).toBeUndefined()
    }
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

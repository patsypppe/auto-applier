// Tests that profile validation accepts good profiles and reports readable errors for bad ones.
import { describe, expect, test } from "vitest"
import { validateProfile } from "./schema"
import type { Profile } from "./types"

const validProfile: Profile = {
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
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
}

describe("validateProfile", () => {
  test("accepts a profile with only the required fields", () => {
    const result = validateProfile(validProfile)

    expect(result).toEqual({ ok: true, profile: validProfile })
  })

  test("accepts a profile with experience, education and a resume", () => {
    const full: Profile = {
      ...validProfile,
      experience: [
        { company: "Acme", title: "Engineer", startDate: "2022-01", description: "Built things" },
      ],
      education: [{ school: "State U", degree: "BSc", startDate: "2018-09", endDate: "2022-05" }],
      skills: ["TypeScript"],
      resume: { name: "resume.pdf", mimeType: "application/pdf", storageKey: "resume-1" },
    }

    expect(validateProfile(full)).toEqual({ ok: true, profile: full })
  })

  test("accepts a city, state and country, all optional", () => {
    const located = { ...validProfile, personal: { ...validProfile.personal, city: "Seattle", state: "WA", country: "United States" } }

    expect(validateProfile(located)).toEqual({ ok: true, profile: located })
    expect(validateProfile({ ...validProfile, personal: { ...validProfile.personal, city: "Seattle" } }).ok).toBe(true)
  })

  test("rejects a city that is not text", () => {
    const result = validateProfile({ ...validProfile, personal: { ...validProfile.personal, city: 5 } })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("personal.city")
  })

  test("rejects an invalid email and names the field", () => {
    const bad = { ...validProfile, personal: { ...validProfile.personal, email: "not-an-email" } }

    const result = validateProfile(bad)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("personal.email")
  })

  test("rejects an empty first name", () => {
    const bad = { ...validProfile, personal: { ...validProfile.personal, firstName: "" } }

    const result = validateProfile(bad)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("personal.firstName")
  })

  test("rejects a non-boolean sponsorship answer", () => {
    const bad = { ...validProfile, answers: { workAuthorization: "Citizen", needsSponsorship: "no" } }

    const result = validateProfile(bad)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("answers.needsSponsorship")
  })

  test("rejects a non-boolean authorized-to-work answer", () => {
    const answers = { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: "yes" }
    const bad = { ...validProfile, answers }

    const result = validateProfile(bad)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("answers.isAuthorizedToWork")
  })

  test("rejects input that is not an object at all", () => {
    expect(validateProfile("hello").ok).toBe(false)
    expect(validateProfile(undefined).ok).toBe(false)
  })

  test("reports every problem, not just the first", () => {
    const bad = { ...validProfile, personal: { ...validProfile.personal, firstName: "", email: "x" } }

    const result = validateProfile(bad)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toHaveLength(2)
  })
})

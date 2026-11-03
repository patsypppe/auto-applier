// Tests the conversion between flat form text and a Profile, in both directions.
import { describe, expect, test } from "vitest"
import { carriedOverOf, emptyFormValues, fromFormValues, toFormValues } from "./formValues"
import type { ProfileFormValues } from "./formValues"
import type { Profile } from "./types"

const filledValues: ProfileFormValues = {
  ...emptyFormValues(),
  firstName: "Pranav",
  lastName: "Pattanashetty",
  email: "pranav@example.com",
  phone: "5551234567",
  workAuthorization: "Citizen",
}

const existingProfile: Profile = {
  personal: {
    firstName: "Pranav",
    middleName: "T",
    lastName: "Pattanashetty",
    email: "pranav@example.com",
    phone: "5551234567",
    links: { github: "github.com/pranav" },
  },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022-01", description: "Built things" }],
  education: [{ school: "State U", degree: "BSc", startDate: "2018-09" }],
  skills: ["TypeScript", "React"],
  answers: { workAuthorization: "Citizen", needsSponsorship: true, isAuthorizedToWork: false, noticePeriod: "2 weeks" },
  resume: { name: "resume.pdf", mimeType: "application/pdf", storageKey: "resume-1" },
}

describe("emptyFormValues", () => {
  test("has blank text and defaults sponsorship to no", () => {
    const values = emptyFormValues()

    expect(values.firstName).toBe("")
    expect(values.needsSponsorship).toBe("no")
    expect(values.isAuthorizedToWork).toBe("yes")
  })
})

describe("fromFormValues", () => {
  test("builds a valid profile from filled values", () => {
    const result = fromFormValues(filledValues)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.profile.personal.firstName).toBe("Pranav")
  })

  test("trims whitespace around text", () => {
    const result = fromFormValues({ ...filledValues, firstName: "  Pranav  " })

    expect(result.ok && result.profile.personal.firstName).toBe("Pranav")
  })

  test("leaves blank optional fields out of the profile", () => {
    const result = fromFormValues(filledValues)

    expect(result.ok && result.profile.personal.middleName).toBeUndefined()
    expect(result.ok && result.profile.answers.noticePeriod).toBeUndefined()
  })

  test("splits skills on commas, trims them and drops empty ones", () => {
    const result = fromFormValues({ ...filledValues, skills: " TypeScript, React ,, " })

    expect(result.ok && result.profile.skills).toEqual(["TypeScript", "React"])
  })

  test("turns the yes/no sponsorship choice into a boolean", () => {
    const yes = fromFormValues({ ...filledValues, needsSponsorship: "yes" })
    const no = fromFormValues({ ...filledValues, needsSponsorship: "no" })

    expect(yes.ok && yes.profile.answers.needsSponsorship).toBe(true)
    expect(no.ok && no.profile.answers.needsSponsorship).toBe(false)
  })

  test("turns the yes/no authorized-to-work choice into a boolean", () => {
    const yes = fromFormValues({ ...filledValues, isAuthorizedToWork: "yes" })
    const no = fromFormValues({ ...filledValues, isAuthorizedToWork: "no" })

    expect(yes.ok && yes.profile.answers.isAuthorizedToWork).toBe(true)
    expect(no.ok && no.profile.answers.isAuthorizedToWork).toBe(false)
  })

  test("starts with empty experience and education when there is no existing profile", () => {
    const result = fromFormValues(filledValues)

    expect(result.ok && result.profile.experience).toEqual([])
    expect(result.ok && result.profile.education).toEqual([])
  })

  test("keeps experience, education and resume from the existing profile", () => {
    const result = fromFormValues(filledValues, existingProfile)

    expect(result.ok && result.profile.experience).toEqual(existingProfile.experience)
    expect(result.ok && result.profile.education).toEqual(existingProfile.education)
    expect(result.ok && result.profile.resume).toEqual(existingProfile.resume)
  })

  test("accepts a carry-over that holds only experience, education and resume", () => {
    const carried = {
      experience: existingProfile.experience,
      education: existingProfile.education,
      resume: existingProfile.resume,
    }

    const result = fromFormValues(filledValues, carried)

    expect(result.ok && result.profile.experience).toEqual(existingProfile.experience)
    expect(result.ok && result.profile.education).toEqual(existingProfile.education)
    expect(result.ok && result.profile.resume).toEqual(existingProfile.resume)
  })

  test("returns errors that name the invalid field", () => {
    const result = fromFormValues({ ...filledValues, email: "not-an-email" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("personal.email")
  })

  test("rejects the empty form because required fields are blank", () => {
    expect(fromFormValues(emptyFormValues()).ok).toBe(false)
  })
})

describe("carriedOverOf", () => {
  test("takes the experience, education and resume from a profile", () => {
    expect(carriedOverOf(existingProfile)).toEqual({
      experience: existingProfile.experience,
      education: existingProfile.education,
      resume: existingProfile.resume,
    })
  })

  test("leaves the resume out when the profile has none", () => {
    const { resume: _resume, ...withoutResume } = existingProfile

    expect(carriedOverOf(withoutResume).resume).toBeUndefined()
  })
})

describe("toFormValues", () => {
  test("turns a profile into flat text, joining skills with commas", () => {
    const values = toFormValues(existingProfile)

    expect(values.middleName).toBe("T")
    expect(values.github).toBe("github.com/pranav")
    expect(values.skills).toBe("TypeScript, React")
    expect(values.needsSponsorship).toBe("yes")
    expect(values.isAuthorizedToWork).toBe("no")
    expect(values.noticePeriod).toBe("2 weeks")
  })

  test("uses blank text for fields the profile does not have", () => {
    expect(toFormValues(existingProfile).linkedin).toBe("")
  })

  test("round-trips: converting to form values and back gives the same profile", () => {
    const result = fromFormValues(toFormValues(existingProfile), existingProfile)

    expect(result).toEqual({ ok: true, profile: existingProfile })
  })
})

// Tests that a parsed draft fills the profile form without touching answers or erasing values it lacks.
import { describe, expect, test } from "vitest"
import { emptyFormValues, toFormValues } from "../profile/formValues"
import type { ProfileFormValues } from "../profile/formValues"
import type { Profile } from "../profile/types"
import { applyDraftToFormValues, buildProfileFromDraft, carryOverFromDraft } from "./applyDraft"
import type { ProfileDraft } from "./types"

const draft: ProfileDraft = {
  personal: {
    firstName: "Pranav",
    middleName: "T",
    lastName: "Pattanashetty",
    email: "pranav@example.com",
    phone: "5551234567",
    city: "Seattle",
    state: "WA",
    country: "",
    links: { linkedin: "linkedin.com/in/pranav", github: "github.com/pranav" },
  },
  experience: [],
  education: [],
  skills: ["TypeScript", "React"],
}

const emptyDraft: ProfileDraft = {
  personal: { firstName: "", middleName: "", lastName: "", email: "", phone: "", city: "", state: "", country: "", links: {} },
  experience: [],
  education: [],
  skills: [],
}

const draftWithHistory: ProfileDraft = {
  ...draft,
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built things" }],
  education: [{ school: "State U", degree: "BSc", startDate: "2018", endDate: "2022" }],
}

const existingProfile: Profile = {
  personal: { firstName: "Old", lastName: "Name", email: "old@example.com", phone: "111", links: {} },
  experience: [{ company: "Old Co", title: "Dev", startDate: "2015", description: "" }],
  education: [{ school: "Old U", degree: "BA", startDate: "2010" }],
  skills: ["COBOL"],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
  resume: { name: "resume.pdf", mimeType: "application/pdf", storageKey: "resume-1" },
}

describe("carryOverFromDraft", () => {
  test("uses the draft's jobs and degrees when it has any", () => {
    const carried = carryOverFromDraft(draftWithHistory, existingProfile)

    expect(carried.experience).toEqual(draftWithHistory.experience)
    expect(carried.education).toEqual(draftWithHistory.education)
  })

  test("keeps the previous jobs and degrees when the draft has none", () => {
    const carried = carryOverFromDraft(draft, existingProfile)

    expect(carried.experience).toEqual(existingProfile.experience)
    expect(carried.education).toEqual(existingProfile.education)
  })

  test("always keeps the previous resume file", () => {
    expect(carryOverFromDraft(draftWithHistory, existingProfile).resume).toEqual(existingProfile.resume)
  })

  test("starts empty when there is nothing previous and the draft has nothing", () => {
    expect(carryOverFromDraft(draft)).toEqual({ experience: [], education: [], resume: undefined })
  })
})

describe("buildProfileFromDraft", () => {
  test("returns a valid profile when the form already holds the required answers", () => {
    const current: ProfileFormValues = { ...emptyFormValues(), workAuthorization: "Citizen" }

    const result = buildProfileFromDraft(draftWithHistory, current)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.profile.personal.firstName).toBe("Pranav")
      expect(result.profile.answers.workAuthorization).toBe("Citizen")
      expect(result.profile.experience).toEqual(draftWithHistory.experience)
      expect(result.profile.education).toEqual(draftWithHistory.education)
      expect(result.profile.skills).toEqual(["TypeScript", "React"])
    }
  })

  test("reports the missing answer when work authorization has not been filled in", () => {
    const result = buildProfileFromDraft(draftWithHistory, emptyFormValues())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("answers.workAuthorization")
  })

  test("reports details from the resume that are not valid", () => {
    const badEmail: ProfileDraft = { ...draft, personal: { ...draft.personal, email: "not-an-email" } }
    const current: ProfileFormValues = { ...emptyFormValues(), workAuthorization: "Citizen" }

    const result = buildProfileFromDraft(badEmail, current)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(" ")).toContain("personal.email")
  })

  test("replaces the saved jobs and degrees with the ones from the resume", () => {
    const result = buildProfileFromDraft(draftWithHistory, toFormValues(existingProfile), existingProfile)

    expect(result.ok && result.profile.experience).toEqual(draftWithHistory.experience)
    expect(result.ok && result.profile.education).toEqual(draftWithHistory.education)
  })

  test("keeps the saved jobs and degrees when the resume had none", () => {
    const result = buildProfileFromDraft(draft, toFormValues(existingProfile), existingProfile)

    expect(result.ok && result.profile.experience).toEqual(existingProfile.experience)
    expect(result.ok && result.profile.education).toEqual(existingProfile.education)
  })

  test("keeps the saved resume file and the saved answers", () => {
    const result = buildProfileFromDraft(draftWithHistory, toFormValues(existingProfile), existingProfile)

    expect(result.ok && result.profile.resume).toEqual(existingProfile.resume)
    expect(result.ok && result.profile.answers).toEqual(existingProfile.answers)
  })

  test("does not change what it was given", () => {
    const current = toFormValues(existingProfile)
    const before = JSON.stringify([draftWithHistory, current, existingProfile])

    buildProfileFromDraft(draftWithHistory, current, existingProfile)

    expect(JSON.stringify([draftWithHistory, current, existingProfile])).toBe(before)
  })
})

describe("applyDraftToFormValues: location", () => {
  test("fills the city and state from the draft", () => {
    const values = applyDraftToFormValues(draft, emptyFormValues())

    expect([values.city, values.state, values.country]).toEqual(["Seattle", "WA", ""])
  })

  test("keeps the country typed in the form when the draft has none", () => {
    const current: ProfileFormValues = { ...emptyFormValues(), country: "United States", city: "Old City" }

    const values = applyDraftToFormValues(draft, current)

    expect(values.country).toBe("United States")
    expect(values.city).toBe("Seattle")
  })

  test("keeps the whole location in the form when the draft has none", () => {
    const current: ProfileFormValues = { ...emptyFormValues(), city: "Austin", state: "TX", country: "United States" }

    const values = applyDraftToFormValues(emptyDraft, current)

    expect([values.city, values.state, values.country]).toEqual(["Austin", "TX", "United States"])
  })
})

describe("applyDraftToFormValues", () => {
  test("fills the personal fields, links and skills from the draft", () => {
    const values = applyDraftToFormValues(draft, emptyFormValues())

    expect(values).toMatchObject({
      firstName: "Pranav",
      middleName: "T",
      lastName: "Pattanashetty",
      email: "pranav@example.com",
      phone: "5551234567",
      linkedin: "linkedin.com/in/pranav",
      github: "github.com/pranav",
      portfolio: "",
      skills: "TypeScript, React",
    })
  })

  test("replaces values already in the form when the draft has one", () => {
    const current: ProfileFormValues = { ...emptyFormValues(), firstName: "Old", skills: "COBOL" }

    const values = applyDraftToFormValues(draft, current)

    expect(values.firstName).toBe("Pranav")
    expect(values.skills).toBe("TypeScript, React")
  })

  test("keeps what is in the form where the draft has nothing", () => {
    const current: ProfileFormValues = {
      ...emptyFormValues(),
      firstName: "Typed",
      phone: "999",
      portfolio: "me.dev",
      skills: "Go",
    }

    const values = applyDraftToFormValues(emptyDraft, current)

    expect(values).toEqual(current)
  })

  test("never touches the answers", () => {
    const current: ProfileFormValues = {
      ...emptyFormValues(),
      workAuthorization: "Citizen",
      needsSponsorship: "yes",
      isAuthorizedToWork: "no",
      noticePeriod: "2 weeks",
      salaryExpectation: "100000",
    }

    const values = applyDraftToFormValues(draft, current)

    expect(values).toMatchObject({
      workAuthorization: "Citizen",
      needsSponsorship: "yes",
      isAuthorizedToWork: "no",
      noticePeriod: "2 weeks",
      salaryExpectation: "100000",
    })
  })

  test("does not change the form values it was given", () => {
    const current = emptyFormValues()

    applyDraftToFormValues(draft, current)

    expect(current).toEqual(emptyFormValues())
  })
})

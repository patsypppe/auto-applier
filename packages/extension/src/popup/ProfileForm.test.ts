// Tests the profile form: it shows the saved profile, can be filled in from outside, and saves what is carried over.
// @vitest-environment jsdom
import type { CarriedOver, Profile, ProfileStore } from "@auto-applier/core"
import { emptyFormValues } from "@auto-applier/core"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { mountProfileForm } from "./ProfileForm"

const SAVED: Profile = {
  personal: { firstName: "Pranav", lastName: "Pattanashetty", email: "pranav@example.com", phone: "555", links: {} },
  experience: [{ company: "Acme", title: "Engineer", startDate: "2022", description: "Built things" }],
  education: [{ school: "State U", degree: "BSc", startDate: "2018", endDate: "2022" }],
  skills: ["TypeScript"],
  answers: { workAuthorization: "Citizen", needsSponsorship: true, isAuthorizedToWork: true },
  resume: { name: "resume.pdf", mimeType: "application/pdf", storageKey: "resume" },
}

// Builds a profile store holding the given profile, with a save that can be watched.
function storeHolding(profile: Profile | undefined) {
  return { load: vi.fn(async () => profile), save: vi.fn(async (_profile: Profile) => undefined) } satisfies ProfileStore
}

// Mounts the form into a fresh page and returns its handle plus helpers for reading and typing.
async function mountForm(profile?: Profile, store = storeHolding(profile)) {
  document.body.innerHTML = '<div id="root"></div>'
  const handle = await mountProfileForm(document.getElementById("root")!, store)
  return { handle, store }
}

// Returns the input or select with the given field name.
function field(name: string): HTMLInputElement | HTMLSelectElement {
  return document.getElementById(name) as HTMLInputElement | HTMLSelectElement
}

// Presses Save and waits until the submit handler has finished.
async function submit(): Promise<void> {
  document.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

// Returns the text of the error messages currently shown.
function shownErrors(): string[] {
  return Array.from(document.querySelectorAll('[role="alert"] li')).map((item) => item.textContent ?? "")
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("ProfileForm: showing what is saved", () => {
  test("fills the fields from the saved profile", async () => {
    await mountForm(SAVED)

    expect(field("firstName").value).toBe("Pranav")
    expect(field("email").value).toBe("pranav@example.com")
    expect(field("skills").value).toBe("TypeScript")
    expect(field("needsSponsorship").value).toBe("yes")
  })

  test("starts empty, with sponsorship set to No, when nothing is saved", async () => {
    const { handle } = await mountForm(undefined)

    expect(field("firstName").value).toBe("")
    expect(field("needsSponsorship").value).toBe("no")
    expect(handle.getCarried()).toBeUndefined()
  })

  test("carries over the saved jobs, degrees and resume", async () => {
    const { handle } = await mountForm(SAVED)

    expect(handle.getCarried()).toEqual({
      experience: SAVED.experience,
      education: SAVED.education,
      resume: SAVED.resume,
    })
  })
})

describe("ProfileForm: the handle", () => {
  test("getValues returns what is currently typed in", async () => {
    const { handle } = await mountForm(SAVED)

    field("firstName").value = "Changed"

    expect(handle.getValues().firstName).toBe("Changed")
    expect(handle.getValues().lastName).toBe("Pattanashetty")
  })

  test("showProfile replaces the fields and what is carried over, and clears errors", async () => {
    const { handle } = await mountForm(undefined)
    handle.showDraft(emptyFormValues(), { experience: [], education: [] }, ["personal.email: Invalid email address"])

    handle.showProfile(SAVED)

    expect(field("firstName").value).toBe("Pranav")
    expect(handle.getCarried()?.experience).toEqual(SAVED.experience)
    expect(shownErrors()).toEqual([])
  })

  test("showDraft fills the fields, lists the errors and keeps what to carry", async () => {
    const { handle } = await mountForm(undefined)
    const carried: CarriedOver = { experience: SAVED.experience, education: [], resume: SAVED.resume }

    handle.showDraft({ ...emptyFormValues(), firstName: "Pranav", skills: "TypeScript, React" }, carried, [
      "answers.workAuthorization: Too small",
    ])

    expect(field("firstName").value).toBe("Pranav")
    expect(field("skills").value).toBe("TypeScript, React")
    expect(shownErrors()).toEqual(["answers.workAuthorization: Too small"])
    expect(handle.getCarried()).toBe(carried)
  })
})

describe("ProfileForm: saving", () => {
  test("saves a valid form and says so", async () => {
    const { store } = await mountForm(SAVED)

    await submit()

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Saved.")
  })

  test("keeps the jobs, degrees and resume when saving", async () => {
    const { store } = await mountForm(SAVED)

    await submit()

    const saved = store.save.mock.calls[0]![0]
    expect(saved.experience).toEqual(SAVED.experience)
    expect(saved.education).toEqual(SAVED.education)
    expect(saved.resume).toEqual(SAVED.resume)
  })

  test("shows the errors and saves nothing when the form is not valid", async () => {
    const { store } = await mountForm(SAVED)
    field("email").value = "not-an-email"

    await submit()

    expect(store.save).not.toHaveBeenCalled()
    expect(shownErrors().join(" ")).toContain("personal.email")
  })

  test("after a draft is shown, saving includes the draft's jobs once the missing answer is added", async () => {
    const { handle, store } = await mountForm(undefined)
    const carried: CarriedOver = { experience: SAVED.experience, education: SAVED.education, resume: SAVED.resume }
    handle.showDraft(
      { ...emptyFormValues(), firstName: "Pranav", lastName: "P", email: "p@example.com", phone: "555" },
      carried,
      ["answers.workAuthorization: Too small"],
    )

    await submit()
    expect(store.save).not.toHaveBeenCalled()

    field("workAuthorization").value = "Citizen"
    await submit()

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(store.save.mock.calls[0]![0].experience).toEqual(SAVED.experience)
    expect(shownErrors()).toEqual([])
  })

  test("shows a message when saving fails", async () => {
    const store = storeHolding(SAVED)
    store.save.mockRejectedValueOnce(new Error("storage is full"))
    await mountForm(SAVED, store)

    await submit()

    expect(shownErrors()).toEqual(["storage is full"])
  })
})

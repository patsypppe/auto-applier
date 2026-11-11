// Tests that renderSettingsForm shows the saved settings, sends what the user changed with the rest kept, and shows mistakes.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import { parseSettings } from "../settings"
import { renderSettingsForm, type SettingsDraft } from "./settingsForm"

const SAVED = parseSettings({
  workAuth: { status: "f1-opt", stemDegree: true },
  filters: { roles: ["data scientist", "quant researcher"], locations: ["New York", "Remote"], myDegree: "master", excludeTitleWords: ["senior"] },
})

// Returns the form control with the given name, and value when several share the name.
function control(form: HTMLFormElement, name: string, value?: string): HTMLInputElement {
  return form.querySelector(value === undefined ? `[name='${name}']` : `[name='${name}'][value='${value}']`) as HTMLInputElement
}

// Submits the form and waits for the save to finish.
async function submit(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event("submit", { cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("renderSettingsForm", () => {
  test("shows the saved settings, with roles not in the list in the free text box", () => {
    const form = renderSettingsForm(SAVED, vi.fn())

    expect(control(form, "status").value).toBe("f1-opt")
    expect(control(form, "needsSponsorshipLater").checked).toBe(true)
    expect(control(form, "stemDegree").checked).toBe(true)
    expect(control(form, "role", "data scientist").checked).toBe(true)
    expect(control(form, "role", "data analyst").checked).toBe(false)
    expect(control(form, "otherRoles").value).toBe("quant researcher")
    expect(control(form, "level", "entry").checked).toBe(true)
    expect(control(form, "locations").value).toBe("New York, Remote")
    expect(control(form, "postedWithinDays").value).toBe("90")
    expect(control(form, "myDegree").value).toBe("master")
  })

  test("sends the changed settings and keeps the ones the form does not show", async () => {
    const onSave = vi.fn<(draft: SettingsDraft) => Promise<string | undefined>>().mockResolvedValue(undefined)
    const form = renderSettingsForm(SAVED, onSave)

    control(form, "status").value = "f1-stem-opt"
    control(form, "role", "data engineer").checked = true
    control(form, "otherRoles").value = "quant researcher, , econometrician"
    control(form, "level", "intern").checked = false
    control(form, "locations").value = ""
    control(form, "maxYearsRequired").value = "3"
    control(form, "myDegree").value = ""
    await submit(form)

    const draft = onSave.mock.calls[0]![0]
    expect(draft.workAuth).toMatchObject({ status: "f1-stem-opt", needsSponsorshipLater: true, stemDegree: true, clearance: "none" })
    expect(draft.filters).toMatchObject({
      roles: ["data scientist", "data engineer", "quant researcher", "econometrician"],
      levels: ["new-grad", "entry"],
      locations: [],
      maxYearsRequired: 3,
      postedWithinDays: 90,
      excludeTitleWords: ["senior"],
    })
    expect(draft.filters).not.toHaveProperty("myDegree")
  })

  test("starts empty for a first setup, so the server asks for a status and a role", async () => {
    const onSave = vi.fn<(draft: SettingsDraft) => Promise<string | undefined>>().mockResolvedValue(undefined)
    const form = renderSettingsForm(undefined, onSave)
    await submit(form)

    const draft = onSave.mock.calls[0]![0]
    expect(draft.workAuth.status).toBe("")
    expect(draft.filters.roles).toEqual([])
    expect(draft.filters).not.toHaveProperty("postedWithinDays")
  })

  test("starts sponsorship later and clearance from the chosen status, and keeps a later change", async () => {
    const onSave = vi.fn<(draft: SettingsDraft) => Promise<string | undefined>>().mockResolvedValue(undefined)
    const form = renderSettingsForm(undefined, onSave)
    const pick = (status: string) => {
      control(form, "status").value = status
      control(form, "status").dispatchEvent(new Event("change"))
    }

    pick("f1-opt")
    expect(control(form, "needsSponsorshipLater").checked).toBe(true)
    expect(control(form, "clearance").value).toBe("none")
    pick("citizen")
    expect(control(form, "needsSponsorshipLater").checked).toBe(false)
    expect(control(form, "clearance").value).toBe("can-obtain")
    control(form, "clearance").value = "active"
    await submit(form)

    expect(onSave.mock.calls[0]![0].workAuth).toMatchObject({ status: "citizen", needsSponsorshipLater: false, clearance: "active" })
  })

  test("shows each mistake the server found on its own line, and clears them after a good save", async () => {
    const onSave = vi.fn<(draft: SettingsDraft) => Promise<string | undefined>>().mockResolvedValueOnce("first mistake\nsecond mistake").mockResolvedValueOnce(undefined)
    const form = renderSettingsForm(SAVED, onSave)

    await submit(form)
    expect(form.querySelector(".errors")!.textContent).toBe("first mistake\nsecond mistake")

    await submit(form)
    expect(form.querySelector(".errors")!.textContent).toBe("")
  })

  test("enables Save again and says so when the save itself throws", async () => {
    const form = renderSettingsForm(SAVED, () => Promise.reject(new Error("lost")))

    await submit(form)

    expect(form.querySelector("button")!.disabled).toBe(false)
    expect(form.querySelector(".errors")!.textContent).toBe("The settings could not be saved.")
  })
})

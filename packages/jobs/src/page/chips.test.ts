// Tests that renderChips shows the filters the server used and reports each change the user makes.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import { renderChips, type ChipChoices } from "./chips"

const USED = { postedWithinDays: 90, workplaces: [], jobTypes: [], levels: ["intern", "new-grad", "entry"], maxYearsRequired: 2, minYearlyPay: 0, myDegree: "master" } as const
const PAGE = { newOnly: false, eVerifyOnly: false, stemOpt: false }

describe("renderChips", () => {
  test("shows the filters in use, with the chosen chips pressed", () => {
    const row = renderChips(USED, PAGE, vi.fn())

    const pressed = [...row.querySelectorAll("button[aria-pressed='true']")].map((button) => button.textContent)
    expect(pressed).toEqual(["intern", "new grad", "entry"])
    expect((row.querySelector("select[name='within']") as HTMLSelectElement).value).toBe("90")
    expect((row.querySelector("select[name='degree']") as HTMLSelectElement).value).toBe("master")
  })

  test("reports a pressed workplace chip as the new list", () => {
    const onChange = vi.fn<(choices: ChipChoices) => void>()
    const row = renderChips(USED, PAGE, onChange)

    ;(row.querySelector("button[data-value='remote']") as HTMLButtonElement).click()

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ workplace: "remote" }))
  })

  test("reports a picked value from a menu", () => {
    const onChange = vi.fn<(choices: ChipChoices) => void>()
    const row = renderChips(USED, PAGE, onChange)
    const menu = row.querySelector("select[name='minPay']") as HTMLSelectElement

    menu.value = "100000"
    menu.dispatchEvent(new Event("change"))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minPay: "100000" }))
  })

  test("reports the 'new since my last visit' chip apart from the server's filters", () => {
    const onChange = vi.fn<(choices: ChipChoices) => void>()
    const row = renderChips(USED, PAGE, onChange)

    ;(row.querySelector("button[data-value='new']") as HTMLButtonElement).click()

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ newOnly: "true" }))
  })

  test("offers 'E-Verify only' to a STEM OPT student, and to no one else", () => {
    const onChange = vi.fn<(choices: ChipChoices) => void>()
    const row = renderChips(USED, { ...PAGE, stemOpt: true }, onChange)

    ;(row.querySelector("button[data-value='e-verify']") as HTMLButtonElement).click()

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ eVerifyOnly: "true" }))
    expect(renderChips(USED, PAGE, vi.fn()).querySelector("button[data-value='e-verify']")).toBeNull()
  })
})

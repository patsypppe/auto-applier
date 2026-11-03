// Tests that ComboboxFiller types into a custom dropdown, waits for its options and clicks the right one.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { fieldForElement } from "../testing/fieldFromHtml"
import { makeField } from "../testing/makeField"
import { ComboboxFiller } from "./ComboboxFiller"

const filler = new ComboboxFiller({ timeoutMs: 150, pollMs: 5 })

type FakeOptions = {
  delayMs?: number
  filter?: boolean
  pickWorks?: boolean
  disabled?: string[]
}

// Builds a fake custom dropdown: typing shows options after a delay, clicking one chooses it and closes the list.
function buildCombobox(optionTexts: string[], settings: FakeOptions = {}) {
  const { delayMs = 10, filter = true, pickWorks = true, disabled = [] } = settings
  document.body.innerHTML = `
    <label for="c">School</label>
    <input id="c" role="combobox" aria-controls="lb" aria-expanded="false" />
    <div id="lb" role="listbox"></div>`

  const input = document.getElementById("c") as HTMLInputElement
  const listbox = document.getElementById("lb") as HTMLElement
  const state = { chosen: "", clicks: [] as string[] }

  // Creates one option element wired to record clicks and, if the pick works, choose and close.
  function makeOption(text: string): HTMLElement {
    const option = document.createElement("div")
    option.setAttribute("role", "option")
    option.textContent = text
    if (disabled.includes(text)) option.setAttribute("aria-disabled", "true")
    for (const type of ["mousedown", "mouseup", "click"]) {
      option.addEventListener(type, () => state.clicks.push(type))
    }
    option.addEventListener("click", () => {
      if (!pickWorks) return
      state.chosen = text
      listbox.replaceChildren()
      input.setAttribute("aria-expanded", "false")
    })
    return option
  }

  input.addEventListener("input", () => {
    setTimeout(() => {
      const shown = optionTexts.filter((text) => !filter || text.toLowerCase().includes(input.value.toLowerCase()))
      listbox.replaceChildren(...shown.map(makeOption))
      input.setAttribute("aria-expanded", "true")
    }, delayMs)
  })

  return { input, field: fieldForElement(input, "combobox"), state }
}

describe("ComboboxFiller: canFill", () => {
  test("accepts combobox fields only", () => {
    expect(filler.canFill(makeField({ kind: "combobox" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "select" }))).toBe(false)
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(false)
  })
})

describe("ComboboxFiller: fill", () => {
  test("types the value, waits for the options and picks the match", async () => {
    const { field, state } = buildCombobox(["Harvard University", "United States Naval Academy"])

    const result = await filler.fill(field, "Harvard University")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("Harvard University")
  })

  test("picks a longer option that starts with the value", async () => {
    const { field, state } = buildCombobox(["Yes, I am authorized", "No, I am not"])

    await filler.fill(field, "Yes")

    expect(state.chosen).toBe("Yes, I am authorized")
  })

  test("clicks the option with mousedown, mouseup and click in that order", async () => {
    const { field, state } = buildCombobox(["Canada", "Mexico"])

    await filler.fill(field, "Canada")

    expect(state.clicks).toEqual(["mousedown", "mouseup", "click"])
  })

  test("waits for options that arrive late", async () => {
    const { field, state } = buildCombobox(["Canada"], { delayMs: 60 })

    const result = await filler.fill(field, "Canada")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("Canada")
  })

  test("fails and clears what it typed when no options ever appear", async () => {
    const { field, input } = buildCombobox(["Canada", "Mexico"])

    const result = await filler.fill(field, "Zzz")

    expect(result).toEqual({ status: "failed", reason: "No options appeared" })
    expect(input.value).toBe("")
  })

  test("fails and clears what it typed when options appear but none match", async () => {
    const { field, input } = buildCombobox(["Canada", "Mexico"], { filter: false })

    const result = await filler.fill(field, "United States")

    expect(result).toEqual({ status: "failed", reason: 'No single option matches "United States"' })
    expect(input.value).toBe("")
  })

  test("fails rather than guess when two options fit", async () => {
    const { field, state } = buildCombobox(["Yes, with sponsorship", "Yes, without sponsorship"], { filter: false })

    const result = await filler.fill(field, "Yes")

    expect(result.status).toBe("failed")
    expect(state.chosen).toBe("")
  })

  test("fails when the matching option is disabled", async () => {
    const { field, state } = buildCombobox(["Open", "Closed (full)"], { disabled: ["Closed (full)"] })

    const result = await filler.fill(field, "Closed")

    expect(result).toEqual({ status: "failed", reason: "Option is disabled" })
    expect(state.chosen).toBe("")
  })

  test("fails when the page does not react to the pick", async () => {
    const { field } = buildCombobox(["Canada"], { pickWorks: false })

    const result = await filler.fill(field, "Canada")

    expect(result).toEqual({ status: "failed", reason: "Could not confirm the page accepted the choice" })
  })

  test("skips when the input already holds different text", async () => {
    const { field, input, state } = buildCombobox(["Canada"])
    input.value = "Harvard"

    const result = await filler.fill(field, "Canada")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(input.value).toBe("Harvard")
    expect(state.chosen).toBe("")
  })

  test("counts an input that already holds the value as filled", async () => {
    const { field, input } = buildCombobox(["Canada"])
    input.value = "Canada"

    expect(await filler.fill(field, "Canada")).toEqual({ status: "filled" })
  })

  test("skips a read-only or disabled input", async () => {
    const { field, input } = buildCombobox(["Canada"])
    input.disabled = true

    expect(await filler.fill(field, "Canada")).toEqual({
      status: "skipped",
      reason: "Field is read-only or disabled",
    })
  })

  test("fails when the element is not an input", async () => {
    const field = fieldForElement(document.createElement("div"), "combobox")

    expect(await filler.fill(field, "Canada")).toEqual({
      status: "failed",
      reason: "Field is not a combobox input",
    })
  })
})

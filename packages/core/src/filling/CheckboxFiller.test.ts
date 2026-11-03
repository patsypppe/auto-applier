// Tests that CheckboxFiller reads Yes/No values and checks a box only when it should.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import { fieldForElement, fieldFromHtml } from "../testing/fieldFromHtml"
import { makeField } from "../testing/makeField"
import { CheckboxFiller } from "./CheckboxFiller"

const filler = new CheckboxFiller()

const UNCHECKED = `<label><input type="checkbox" name="s" /> I require sponsorship</label>`
const CHECKED = `<label><input type="checkbox" name="s" checked /> I require sponsorship</label>`

// Returns the checkbox element behind a field.
function boxOf(field: FormField): HTMLInputElement {
  return field.element as HTMLInputElement
}

describe("CheckboxFiller: canFill", () => {
  test("accepts checkbox fields only", () => {
    expect(filler.canFill(makeField({ kind: "checkbox" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "radio" }))).toBe(false)
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(false)
  })
})

describe("CheckboxFiller: fill", () => {
  test("checks an unchecked box for Yes", () => {
    const field = fieldFromHtml(UNCHECKED)

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(boxOf(field).checked).toBe(true)
  })

  test("fires a change event when it checks the box", () => {
    const field = fieldFromHtml(UNCHECKED)
    const events: string[] = []
    field.element.addEventListener("change", () => events.push("change"))

    filler.fill(field, "Yes")

    expect(events).toEqual(["change"])
  })

  test("understands true as yes", () => {
    const field = fieldFromHtml(UNCHECKED)

    expect(filler.fill(field, "true")).toEqual({ status: "filled" })
    expect(boxOf(field).checked).toBe(true)
  })

  test("leaves an unchecked box as it is for No, without events", () => {
    const field = fieldFromHtml(UNCHECKED)
    const events: string[] = []
    field.element.addEventListener("change", () => events.push("change"))

    const result = filler.fill(field, "No")

    expect(result).toEqual({ status: "filled" })
    expect(boxOf(field).checked).toBe(false)
    expect(events).toEqual([])
  })

  test("counts an already checked box as filled for Yes, without events", () => {
    const field = fieldFromHtml(CHECKED)
    const events: string[] = []
    field.element.addEventListener("change", () => events.push("change"))

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(events).toEqual([])
  })

  test("does not uncheck a box that is already checked, even for No", () => {
    const field = fieldFromHtml(CHECKED)

    const result = filler.fill(field, "No")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(boxOf(field).checked).toBe(true)
  })

  test("fails for a value that is not Yes or No", () => {
    const field = fieldFromHtml(UNCHECKED)

    const result = filler.fill(field, "Maybe")

    expect(result).toEqual({ status: "failed", reason: "Checkbox needs a Yes or No value" })
    expect(boxOf(field).checked).toBe(false)
  })

  test("skips a disabled checkbox", () => {
    document.body.innerHTML = `<input type="checkbox" name="s" disabled />`
    const field = fieldForElement(document.querySelector("input")!, "checkbox")

    expect(filler.fill(field, "Yes")).toEqual({ status: "skipped", reason: "Field is disabled" })
  })

  test("fails when the element is not a checkbox", () => {
    const field = makeField({ kind: "checkbox" })

    expect(filler.fill(field, "Yes")).toEqual({ status: "failed", reason: "Field is not a checkbox" })
  })
})

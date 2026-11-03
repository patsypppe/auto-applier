// Tests that SelectFiller picks the matching dropdown option and leaves the field alone when it should.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import { fieldForElement, fieldFromHtml } from "../testing/fieldFromHtml"
import { makeField } from "../testing/makeField"
import { SelectFiller } from "./SelectFiller"

const filler = new SelectFiller()

const PLACEHOLDER_SELECT = `
  <select name="auth">
    <option value="">Select…</option>
    <option value="y">Yes, I am authorized</option>
    <option value="n">No, I am not</option>
  </select>`

// Returns the select element behind a field.
function selectOf(field: FormField): HTMLSelectElement {
  return field.element as HTMLSelectElement
}

describe("SelectFiller: canFill", () => {
  test("accepts select fields only", () => {
    expect(filler.canFill(makeField({ kind: "select" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(false)
    expect(filler.canFill(makeField({ kind: "radio" }))).toBe(false)
  })
})

describe("SelectFiller: fill", () => {
  test("selects the option whose text matches", () => {
    const field = fieldFromHtml(PLACEHOLDER_SELECT)

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(selectOf(field).value).toBe("y")
  })

  test("fires input and change events so the page notices", () => {
    const field = fieldFromHtml(PLACEHOLDER_SELECT)
    const events: string[] = []
    field.element.addEventListener("input", () => events.push("input"))
    field.element.addEventListener("change", () => events.push("change"))

    filler.fill(field, "No")

    expect(events).toEqual(["input", "change"])
  })

  test("never picks the empty placeholder option", () => {
    const field = fieldFromHtml(PLACEHOLDER_SELECT)

    const result = filler.fill(field, "Select")

    expect(result).toEqual({ status: "failed", reason: 'No single option matches "Select"', code: "no-option-match" })
    expect(selectOf(field).value).toBe("")
  })

  test("fails with a reason when no option matches, leaving the field untouched", () => {
    const field = fieldFromHtml(PLACEHOLDER_SELECT)

    const result = filler.fill(field, "Maybe")

    expect(result).toEqual({ status: "failed", reason: 'No single option matches "Maybe"', code: "no-option-match" })
    expect(selectOf(field).value).toBe("")
  })

  test("fails rather than guess when two options fit", () => {
    const field = fieldFromHtml(`
      <select><option value="">Select…</option>
        <option value="a">Yes, with sponsorship</option>
        <option value="b">Yes, without sponsorship</option>
      </select>`)

    expect(filler.fill(field, "Yes").status).toBe("failed")
  })

  test("skips when a different option is already chosen", () => {
    const field = fieldFromHtml(`
      <select><option value="">Select…</option>
        <option value="y">Yes</option><option value="n" selected>No</option>
      </select>`)

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(selectOf(field).value).toBe("n")
  })

  test("counts the right option already being chosen as filled, without events", () => {
    const field = fieldFromHtml(`
      <select><option value="">Select…</option>
        <option value="y" selected>Yes</option><option value="n">No</option>
      </select>`)
    const events: string[] = []
    field.element.addEventListener("change", () => events.push("change"))

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(events).toEqual([])
  })

  test("treats an untouched first option as empty and still fills (and notifies the page)", () => {
    const field = fieldFromHtml(`<select><option value="ca">Canada</option><option value="us">United States</option></select>`)
    const events: string[] = []
    field.element.addEventListener("change", () => events.push("change"))

    const first = filler.fill(field, "Canada")

    expect(first).toEqual({ status: "filled" })
    expect(selectOf(field).value).toBe("ca")
    expect(events).toEqual(["change"])
  })

  test("fills a select with no placeholder by moving off the untouched first option", () => {
    const field = fieldFromHtml(`<select><option value="ca">Canada</option><option value="us">United States</option></select>`)

    expect(filler.fill(field, "United States")).toEqual({ status: "filled" })
    expect(selectOf(field).value).toBe("us")
  })

  test("respects a first option the page marked as selected", () => {
    const field = fieldFromHtml(`<select><option value="ca" selected>Canada</option><option value="us">United States</option></select>`)

    const result = filler.fill(field, "United States")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(selectOf(field).value).toBe("ca")
  })

  test("skips a disabled select", () => {
    document.body.innerHTML = `<select disabled><option value="">Select…</option><option value="y">Yes</option></select>`
    const field = fieldForElement(document.querySelector("select")!, "select")

    expect(filler.fill(field, "Yes")).toEqual({ status: "skipped", reason: "Field is disabled" })
  })

  test("fails when the matching option is disabled", () => {
    const field = fieldFromHtml(`<select><option value="">Select…</option><option value="y" disabled>Yes</option></select>`)

    expect(filler.fill(field, "Yes")).toEqual({ status: "failed", reason: "Option is disabled" })
    expect(selectOf(field).value).toBe("")
  })

  test("fails when the element is not a select", () => {
    const field = makeField({ kind: "select" })

    expect(filler.fill(field, "Yes")).toEqual({ status: "failed", reason: "Field is not a dropdown" })
  })
})

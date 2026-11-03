// Tests that CheckboxGroupFiller ticks the box whose label matches the value, and never changes a group the user has already answered.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { discoverFields } from "../fields/discoverFields"
import { makeField } from "../testing/makeField"
import { CheckboxGroupFiller } from "./CheckboxGroupFiller"

const filler = new CheckboxGroupFiller()

// Loads a group of checkboxes (with the given labels, some checked) and returns its field.
function groupOf(labels: string[], checked: string[] = []) {
  document.body.innerHTML = `<fieldset><legend>Countries</legend>${labels
    .map(
      (label, index) =>
        `<label><input type="checkbox" name="g[]" id="c${index}" ${checked.includes(label) ? "checked" : ""} /> ${label}</label>`,
    )
    .join("")}</fieldset>`
  const [field] = discoverFields(document)
  if (!field) throw new Error("No field found")
  return field
}

// Returns the labels of the boxes that are checked.
function checkedLabels(labels: string[]): string[] {
  return labels.filter((_label, index) => (document.getElementById(`c${index}`) as HTMLInputElement).checked)
}

describe("CheckboxGroupFiller", () => {
  const LABELS = ["US", "UK", "Germany"]

  test("accepts checkbox-group fields only", () => {
    expect(filler.canFill(makeField({ kind: "checkbox-group" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "checkbox" }))).toBe(false)
    expect(filler.canFill(makeField({ kind: "radio" }))).toBe(false)
  })

  test("ticks the box whose label matches and leaves the others", () => {
    const field = groupOf(LABELS)

    expect(filler.fill(field, "Germany")).toEqual({ status: "filled" })
    expect(checkedLabels(LABELS)).toEqual(["Germany"])
  })

  test("fails with the option-match code when no box fits", () => {
    const field = groupOf(LABELS)

    expect(filler.fill(field, "United States")).toMatchObject({ status: "failed", code: "no-option-match" })
    expect(checkedLabels(LABELS)).toEqual([])
  })

  test("counts the wanted box as filled when it is already ticked", () => {
    const field = groupOf(LABELS, ["UK"])

    expect(filler.fill(field, "UK")).toEqual({ status: "filled" })
  })

  test("skips a group where a different box is already ticked", () => {
    const field = groupOf(LABELS, ["US"])

    expect(filler.fill(field, "UK")).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(checkedLabels(LABELS)).toEqual(["US"])
  })

  test("fails when the matching box is disabled", () => {
    const field = groupOf(LABELS)
    ;(document.getElementById("c1") as HTMLInputElement).disabled = true

    expect(filler.fill(field, "UK")).toMatchObject({ status: "failed", reason: "Option is disabled" })
  })

  test("fails when the page does not accept the click", () => {
    const field = groupOf(LABELS)
    document.getElementById("c2")!.addEventListener("click", (event) => event.preventDefault())

    expect(filler.fill(field, "Germany")).toMatchObject({ status: "failed", reason: "The page did not accept the value" })
  })

  test("fails when the field's element is not a checkbox", () => {
    expect(filler.fill(makeField({ kind: "checkbox-group" }), "UK")).toMatchObject({ status: "failed" })
  })
})

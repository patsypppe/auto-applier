// Tests that RadioFiller checks the radio whose label matches, and leaves the group alone when it should.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { discoverFields } from "../fields/discoverFields"
import { fieldFromHtml } from "../testing/fieldFromHtml"
import { makeField } from "../testing/makeField"
import { RadioFiller } from "./RadioFiller"

const filler = new RadioFiller()

const YES_NO = `
  <fieldset>
    <legend>Are you authorized to work?</legend>
    <label><input type="radio" name="auth" value="y" /> Yes</label>
    <label><input type="radio" name="auth" value="n" /> No</label>
  </fieldset>`

// Returns the radio inputs currently on the page.
function radios(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
}

describe("RadioFiller: canFill", () => {
  test("accepts radio fields only", () => {
    expect(filler.canFill(makeField({ kind: "radio" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "checkbox" }))).toBe(false)
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(false)
  })
})

describe("RadioFiller: fill", () => {
  test("checks the radio whose label matches the value", () => {
    const field = fieldFromHtml(YES_NO)

    const result = filler.fill(field, "No")

    expect(result).toEqual({ status: "filled" })
    expect(radios().map((radio) => radio.checked)).toEqual([false, true])
  })

  test("fires a change event so the page notices", () => {
    const field = fieldFromHtml(YES_NO)
    const events: string[] = []
    document.addEventListener("change", () => events.push("change"))

    filler.fill(field, "Yes")

    expect(events).toEqual(["change"])
  })

  test("matches a longer label that starts with the value", () => {
    const field = fieldFromHtml(`
      <fieldset><legend>Authorized?</legend>
        <label><input type="radio" name="a" /> Yes, I am authorized</label>
        <label><input type="radio" name="a" /> No, I am not</label>
      </fieldset>`)

    filler.fill(field, "Yes")

    expect(radios().map((radio) => radio.checked)).toEqual([true, false])
  })

  test("fails with a reason when no label matches, checking nothing", () => {
    const field = fieldFromHtml(YES_NO)

    const result = filler.fill(field, "Maybe")

    expect(result).toEqual({ status: "failed", reason: 'No single option matches "Maybe"', code: "no-option-match" })
    expect(radios().some((radio) => radio.checked)).toBe(false)
  })

  test("skips when a different radio is already checked", () => {
    const field = fieldFromHtml(YES_NO)
    radios()[1]!.checked = true

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(radios().map((radio) => radio.checked)).toEqual([false, true])
  })

  test("counts the right radio already being checked as filled, without events", () => {
    const field = fieldFromHtml(YES_NO)
    radios()[0]!.checked = true
    const events: string[] = []
    document.addEventListener("change", () => events.push("change"))

    const result = filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(events).toEqual([])
  })

  test("fails when the matching radio is disabled", () => {
    const field = fieldFromHtml(`
      <fieldset><legend>Q</legend>
        <label><input type="radio" name="q" /> Yes</label>
        <label><input type="radio" name="q" disabled /> No</label>
      </fieldset>`)

    expect(filler.fill(field, "No")).toEqual({ status: "failed", reason: "Option is disabled" })
    expect(radios().some((radio) => radio.checked)).toBe(false)
  })

  test("only touches radios in the same form", () => {
    document.body.innerHTML = `
      <form id="a"><label><input type="radio" name="x" /> Yes</label><label><input type="radio" name="x" /> No</label></form>
      <form id="b"><label><input type="radio" name="x" /> Yes</label><label><input type="radio" name="x" /> No</label></form>`
    const [first] = discoverFields(document)

    filler.fill(first!, "Yes")

    expect(radios().map((radio) => radio.checked)).toEqual([true, false, false, false])
  })

  test("fails when the element is not a radio button", () => {
    const field = makeField({ kind: "radio" })

    expect(filler.fill(field, "Yes")).toEqual({ status: "failed", reason: "Field is not a radio button" })
  })
})

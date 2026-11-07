// Tests that the context read around a field (section, help text, limits, errors) is what the model needs to answer it well.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { fieldFromHtml } from "../testing/fieldFromHtml"
import { describeFieldContext } from "./fieldContext"

describe("describeFieldContext", () => {
  test("reports required, input type, placeholder and the length limit", () => {
    const field = fieldFromHtml(`<label for="p">Phone</label><input id="p" type="tel" required maxlength="12" placeholder="555-123-4567">`)

    expect(describeFieldContext(field)).toEqual({ required: true, inputType: "tel", placeholder: "555-123-4567", maxLength: 12 })
  })

  test("reports nothing for a plain optional text box", () => {
    const field = fieldFromHtml(`<label for="n">Nickname</label><input id="n" type="text">`)

    expect(describeFieldContext(field)).toEqual({})
  })

  test("reads the help text the field is described by", () => {
    const field = fieldFromHtml(`<label for="s">Salary</label><input id="s" aria-describedby="h"><p id="h">Annual, in US dollars</p>`)

    expect(describeFieldContext(field).help).toBe("Annual, in US dollars")
  })

  test("treats the described-by text of an invalid field as its error, not as help", () => {
    const field = fieldFromHtml(`<label for="e">Email</label><input id="e" aria-invalid="true" aria-describedby="m"><p id="m">Enter a valid email</p>`)

    const context = describeFieldContext(field)

    expect(context.error).toBe("Enter a valid email")
    expect(context.help).toBeUndefined()
  })

  test("names the section by the nearest heading above the field", () => {
    const field = fieldFromHtml(`<section><h2>Work authorization</h2><div><label for="a">Visa type</label><input id="a"></div></section>`)

    expect(describeFieldContext(field).section).toBe("Work authorization")
  })

  test("names the section by the fieldset legend when there is one", () => {
    const field = fieldFromHtml(`<fieldset><legend>Education</legend><label for="d">Degree</label><input id="d"></fieldset>`)

    expect(describeFieldContext(field).section).toBe("Education")
  })

  test("does not repeat the label as the section", () => {
    const field = fieldFromHtml(`<fieldset><legend>Gender</legend><label><input type="radio" name="g"> Male</label><label><input type="radio" name="g"> Female</label></fieldset>`)

    expect(describeFieldContext(field).section).toBeUndefined()
  })

  test("cuts very long text", () => {
    const field = fieldFromHtml(`<label for="x">X</label><input id="x" aria-describedby="h"><p id="h">${"a".repeat(1000)}</p>`)

    expect(describeFieldContext(field).help?.length).toBeLessThanOrEqual(200)
  })
})

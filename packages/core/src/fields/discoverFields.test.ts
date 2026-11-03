// Tests that form controls on a page are found, classified and labelled correctly.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { discoverFields } from "./discoverFields"

// Loads the HTML into the fake page and returns the fields found in it.
function discover(html: string) {
  document.body.innerHTML = html
  return discoverFields(document)
}

describe("discoverFields: finding controls", () => {
  test("returns nothing for a page with no controls", () => {
    expect(discover("<p>Hello</p>")).toEqual([])
  })

  test("describes a text input with its label and name", () => {
    const fields = discover(`<label for="fn">First name</label><input id="fn" name="first_name" />`)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({ kind: "text", label: "First name", name: "first_name", options: [] })
  })

  test("keeps the controls in page order", () => {
    const fields = discover(`<input name="a" /><textarea name="b"></textarea><input name="c" />`)

    expect(fields.map((field) => field.name)).toEqual(["a", "b", "c"])
  })

  test("only scans inside the root it is given", () => {
    document.body.innerHTML = `<input name="outside" /><div id="form"><input name="inside" /></div>`
    const root = document.getElementById("form")!

    expect(discoverFields(root).map((field) => field.name)).toEqual(["inside"])
  })

  test("skips hidden, button, password and disabled controls", () => {
    const fields = discover(`
      <input type="hidden" name="csrf" />
      <input type="submit" name="go" />
      <input type="button" name="b" />
      <input type="password" name="pw" />
      <input name="off" disabled />
      <input name="kept" />`)

    expect(fields.map((field) => field.name)).toEqual(["kept"])
  })
})

describe("discoverFields: kinds", () => {
  test("treats email, tel, url, number and textarea as text", () => {
    const fields = discover(`
      <input type="email" name="e" /><input type="tel" name="t" />
      <input type="url" name="u" /><input type="number" name="n" /><textarea name="x"></textarea>`)

    expect(fields.map((field) => field.kind)).toEqual(["text", "text", "text", "text", "text"])
  })

  test("recognises date, file and checkbox inputs", () => {
    const fields = discover(`
      <input type="date" name="d" /><input type="file" name="f" /><input type="checkbox" name="c" />`)

    expect(fields.map((field) => field.kind)).toEqual(["date", "file", "checkbox"])
  })

  test("recognises an input with the combobox role", () => {
    const fields = discover(`<input role="combobox" name="school" />`)

    expect(fields[0]?.kind).toBe("combobox")
  })

  test("describes a select with its options, skipping the empty placeholder", () => {
    const fields = discover(`
      <select name="country">
        <option value="">Select…</option>
        <option value="us">United States</option>
        <option value="ca">Canada</option>
      </select>`)

    expect(fields[0]).toMatchObject({ kind: "select", options: ["United States", "Canada"] })
  })

  test("describes a radio group as one field with the choices as options", () => {
    const fields = discover(`
      <fieldset>
        <legend>Are you authorized to work?</legend>
        <label><input type="radio" name="auth" value="y" /> Yes</label>
        <label><input type="radio" name="auth" value="n" /> No</label>
      </fieldset>`)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({
      kind: "radio",
      label: "Are you authorized to work?",
      name: "auth",
      groupId: "auth",
      options: ["Yes", "No"],
    })
    expect(fields[0]?.element).toBe(document.querySelector("input[name=auth]"))
  })
})

describe("discoverFields: labels", () => {
  test("uses a label that wraps the input", () => {
    const fields = discover(`<label>Email <input name="email" /></label>`)

    expect(fields[0]?.label).toBe("Email")
  })

  test("does not include a wrapped select's options in its label", () => {
    const fields = discover(`<label>Country <select name="c"><option value="us">United States</option></select></label>`)

    expect(fields[0]?.label).toBe("Country")
  })

  test("uses aria-labelledby", () => {
    const fields = discover(`<span id="l1">Phone</span><span id="l2">number</span><input name="p" aria-labelledby="l1 l2" />`)

    expect(fields[0]?.label).toBe("Phone number")
  })

  test("uses aria-label", () => {
    const fields = discover(`<input name="p" aria-label="Phone" />`)

    expect(fields[0]?.label).toBe("Phone")
  })

  test("falls back to the placeholder", () => {
    const fields = discover(`<input name="p" placeholder="Your phone" />`)

    expect(fields[0]?.label).toBe("Your phone")
  })

  test("prefers a real label over the placeholder", () => {
    const fields = discover(`<label for="p">Phone</label><input id="p" name="p" placeholder="Your phone" />`)

    expect(fields[0]?.label).toBe("Phone")
  })

  test("collapses whitespace and drops a trailing required asterisk", () => {
    const fields = discover(`<label for="e">  Email   address  * </label><input id="e" name="e" />`)

    expect(fields[0]?.label).toBe("Email address")
  })

  test("uses an empty label when the control has no label at all", () => {
    const fields = discover(`<input name="mystery" />`)

    expect(fields[0]?.label).toBe("")
  })

  test("uses the id as the name when the control has no name attribute", () => {
    const fields = discover(`<input id="only_id" />`)

    expect(fields[0]?.name).toBe("only_id")
  })
})

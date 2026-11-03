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

  test("skips controls marked aria-hidden, such as the invisible helper inputs some dropdown libraries add", () => {
    const fields = discover(`
      <input name="real" />
      <input name="helper" aria-hidden="true" tabindex="-1" />
    `)

    expect(fields.map((field) => field.name)).toEqual(["real"])
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

describe("discoverFields: fields that are not part of the application", () => {
  test("skips search boxes", () => {
    const fields = discover(`<input type="search" name="q" /><input name="real" />`)

    expect(fields.map((field) => field.name)).toEqual(["real"])
  })

  test.each([
    ["footer", "<footer><input name='email' /></footer>"],
    ["nav", "<nav><input name='email' /></nav>"],
    ["header", "<header><input name='email' /></header>"],
    ["contentinfo role", "<div role='contentinfo'><input name='email' /></div>"],
    ["navigation role", "<div role='navigation'><input name='email' /></div>"],
    ["banner role", "<div role='banner'><input name='email' /></div>"],
    ["search role", "<div role='search'><input name='email' /></div>"],
  ])("skips a field inside a %s", (_landmark, html) => {
    expect(discover(`${html}<main><input name="real" /></main>`).map((field) => field.name)).toEqual(["real"])
  })

  test.each([
    ["an id on the field", `<input id="newsletter-email" name="email" />`],
    ["a name on the field", `<input name="subscribe_email" />`],
    ["a class on the form", `<form class="Newsletter-signup"><input name="email" /></form>`],
    ["an id on a wrapper", `<div id="footer-newsletter"><input name="email" /></div>`],
    ["a class naming a subscription", `<form class="subscription-box"><input name="email" /></form>`],
  ])("skips a newsletter or subscription signup, found by %s", (_how, html) => {
    expect(discover(`${html}<form id="apply"><input name="real" /></form>`).map((field) => field.name)).toEqual(["real"])
  })

  test("keeps the fields of a normal application form", () => {
    const fields = discover(`<main><form id="application-form"><input name="email" /><input name="phone" /></form></main>`)

    expect(fields.map((field) => field.name)).toEqual(["email", "phone"])
  })
})

describe("discoverFields: hidden fields", () => {
  // Marks an element as drawn or not, the way a browser's checkVisibility answers.
  function setVisible(id: string, visible: boolean): void {
    Object.assign(document.getElementById(id) as HTMLElement, { checkVisibility: () => visible })
  }

  test("skips a text field, select or combobox that is not rendered", () => {
    document.body.innerHTML = `
      <input id="t" name="t" /><select id="s" name="s"><option>A</option></select>
      <input id="c" name="c" role="combobox" /><input id="shown" name="shown" />`
    for (const id of ["t", "s", "c"]) setVisible(id, false)
    setVisible("shown", true)

    expect(discoverFields(document).map((field) => field.name)).toEqual(["shown"])
  })

  test("keeps checkboxes, radios and file inputs even when they are not rendered, because pages hide them behind styled controls", () => {
    document.body.innerHTML = `
      <input id="box" type="checkbox" name="agree" />
      <input id="radio" type="radio" name="r" />
      <input id="file" type="file" name="resume" />`
    for (const id of ["box", "radio", "file"]) setVisible(id, false)

    expect(discoverFields(document).map((field) => field.kind)).toEqual(["checkbox", "radio", "file"])
  })

  test("treats everything as visible when the browser cannot say", () => {
    document.body.innerHTML = `<input id="t" name="t" />`

    expect(discoverFields(document)).toHaveLength(1)
  })
})

describe("discoverFields: groups of checkboxes", () => {
  const GROUP = `
    <fieldset>
      <legend>Please select the countries you will work in. *</legend>
      <label><input type="checkbox" name="countries[]" id="us" /> US</label>
      <label><input type="checkbox" name="countries[]" id="uk" /> UK</label>
      <label><input type="checkbox" name="countries[]" id="de" /> Germany</label>
    </fieldset>`

  test("describes checkboxes that share a name as one field with the question as its label", () => {
    const fields = discover(GROUP)

    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({
      kind: "checkbox-group",
      label: "Please select the countries you will work in.",
      name: "countries[]",
      groupId: "countries[]",
      options: ["US", "UK", "Germany"],
    })
    expect(fields[0]?.element.id).toBe("us")
  })

  test("leaves a lone checkbox as a single checkbox", () => {
    const fields = discover(`<label><input type="checkbox" name="agree" /> I agree</label>`)

    expect(fields.map((field) => field.kind)).toEqual(["checkbox"])
  })

  test("leaves checkboxes without a name as separate checkboxes", () => {
    const fields = discover(`<input type="checkbox" /><input type="checkbox" />`)

    expect(fields.map((field) => field.kind)).toEqual(["checkbox", "checkbox"])
  })

  test("keeps checkboxes with the same name in different forms apart", () => {
    const fields = discover(`
      <form><input type="checkbox" name="x" /><input type="checkbox" name="x" /></form>
      <form><input type="checkbox" name="x" /></form>`)

    expect(fields.map((field) => field.kind)).toEqual(["checkbox-group", "checkbox"])
  })

  test("ignores disabled checkboxes when forming the group", () => {
    const fields = discover(`<input type="checkbox" name="x" /><input type="checkbox" name="x" disabled />`)

    expect(fields.map((field) => field.kind)).toEqual(["checkbox"])
  })
})

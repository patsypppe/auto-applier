// Tests that a page already showing the application form is told apart from a job description with an Apply button.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { hasApplicationForm } from "./applicationForm"

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("hasApplicationForm", () => {
  test("is true for a page with three or more fillable fields", () => {
    document.body.innerHTML = `<label for="a">A</label><input id="a"><label for="b">B</label><input id="b"><label for="c">C</label><input id="c">`

    expect(hasApplicationForm(document)).toBe(true)
  })

  test("is false for a job description with at most a search box or two fields", () => {
    document.body.innerHTML = `<h1>Engineer</h1><label for="a">Email alerts</label><input id="a"><button>Apply</button>`

    expect(hasApplicationForm(document)).toBe(false)
  })

  test("is false for a page with no fields", () => {
    document.body.innerHTML = `<p>Hello</p>`

    expect(hasApplicationForm(document)).toBe(false)
  })
})

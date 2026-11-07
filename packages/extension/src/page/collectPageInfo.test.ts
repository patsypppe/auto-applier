// Tests that the page's host, title and form step are read for the AI, cut to a safe length.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { collectPageInfo } from "./collectPageInfo"

beforeEach(() => {
  document.title = ""
  document.body.innerHTML = ""
})

describe("collectPageInfo", () => {
  test("reads the host and the page title", () => {
    document.title = "Engineer at Acme"

    expect(collectPageInfo(document, { hostname: "jobs.acme.com" })).toEqual({ host: "jobs.acme.com", title: "Engineer at Acme" })
  })

  test("reads the heading inside the form as the step", () => {
    document.body.innerHTML = `<h1>Engineer</h1><form><h2>Your information</h2><input></form>`

    expect(collectPageInfo(document, { hostname: "x.com" }).step).toBe("Your information")
  })

  test("falls back to a legend when the form has no heading", () => {
    document.body.innerHTML = `<form><fieldset><legend>Work history</legend><input></fieldset></form>`

    expect(collectPageInfo(document, { hostname: "x.com" }).step).toBe("Work history")
  })

  test("has no step when the form has neither", () => {
    document.body.innerHTML = `<form><input></form>`

    expect(collectPageInfo(document, { hostname: "x.com" })).not.toHaveProperty("step")
  })

  test("cuts a very long title", () => {
    document.title = "t".repeat(1000)

    expect(collectPageInfo(document, { hostname: "x.com" }).title.length).toBeLessThanOrEqual(200)
  })
})

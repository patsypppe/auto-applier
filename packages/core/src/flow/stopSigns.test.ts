// Tests that a CAPTCHA or a login form is recognised, so the flow stops and hands over to the user.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { detectStopSign } from "./stopSigns"

beforeEach(() => {
  document.body.innerHTML = ""
})

// Detects a stop sign on a page made of the given HTML.
function detect(html: string) {
  document.body.innerHTML = html
  return detectStopSign(document)
}

describe("detectStopSign", () => {
  test.each([
    `<div class="g-recaptcha" data-sitekey="k"></div>`,
    `<div class="h-captcha" data-sitekey="k"></div>`,
    `<div class="cf-turnstile"></div>`,
    `<iframe src="https://www.google.com/recaptcha/api2/anchor?k=1"></iframe>`,
    `<iframe src="https://newassets.hcaptcha.com/captcha/v1/abc"></iframe>`,
  ])("recognises a CAPTCHA: %s", (html) => {
    expect(detect(html)?.kind).toBe("captcha")
  })

  test("ignores an invisible CAPTCHA that asks the person nothing", () => {
    expect(detect(`<div class="g-recaptcha" data-size="invisible"></div>`)).toBeUndefined()
  })

  test("ignores a hidden CAPTCHA container", () => {
    expect(detect(`<div hidden><div class="h-captcha"></div></div>`)).toBeUndefined()
  })

  test("recognises a password field as a login or sign-up form", () => {
    expect(detect(`<input type="password">`)?.kind).toBe("login")
  })

  test("ignores a disabled or hidden password field", () => {
    expect(detect(`<input type="password" disabled>`)).toBeUndefined()
    expect(detect(`<div hidden><input type="password"></div>`)).toBeUndefined()
  })

  test("finds nothing on an ordinary form", () => {
    expect(detect(`<label for="a">Name</label><input id="a">`)).toBeUndefined()
  })
})

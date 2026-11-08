// Recognises pages the extension must hand back to the person: a CAPTCHA to solve, or a login or sign-up form.
export type StopSign = { kind: "captcha" | "login"; detail: string }

const CAPTCHA =
  ".g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*='recaptcha/api2/anchor'], iframe[src*='hcaptcha.com'], iframe[src*='challenges.cloudflare.com']"

// Returns true when the element is not hidden and, where the browser can say, drawn.
function isShown(element: Element): boolean {
  if (element.closest("[hidden]") || element.closest("[aria-hidden='true']")) return false
  return !(typeof element.checkVisibility === "function" && !element.checkVisibility({ checkVisibilityCSS: true }))
}

// Returns true for a CAPTCHA that asks the person for something.
function needsSolving(element: Element): boolean {
  return element.getAttribute("data-size") !== "invisible" && isShown(element)
}

// Returns why the flow must stop for the person on this page, or undefined when it may carry on.
export function detectStopSign(root: ParentNode): StopSign | undefined {
  if (Array.from(root.querySelectorAll(CAPTCHA)).some(needsSolving)) {
    return { kind: "captcha", detail: "There is a CAPTCHA on this page. Solve it yourself, then press Fill and continue again." }
  }
  const password = Array.from(root.querySelectorAll<HTMLInputElement>("input[type='password']"))
  if (password.some((input) => !input.disabled && isShown(input))) {
    return { kind: "login", detail: "This page asks for a password (a login or sign-up). Do that yourself, then press Fill and continue again." }
  }
  return undefined
}

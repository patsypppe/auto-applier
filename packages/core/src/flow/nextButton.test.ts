// Tests that only a plain Next or Continue button is ever chosen to click, and that anything that could submit stops the flow.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { findNextButton } from "./nextButton"

beforeEach(() => {
  document.body.innerHTML = ""
})

// Finds the button on a page made of the given HTML.
function find(html: string) {
  document.body.innerHTML = html
  return findNextButton(document)
}

describe("findNextButton: buttons that may be clicked", () => {
  test.each(["Next", "next", "Next step", "Continue", "Save and continue", "Save & Continue", "Continue to next step"])(
    "chooses a button labelled %s",
    (label) => {
      const result = find(`<button type="button">${label}</button>`)

      expect(result.kind).toBe("next")
    },
  )

  test("chooses a link styled as a button and an input button", () => {
    expect(find(`<a role="button" href="#">Next</a>`).kind).toBe("next")
    expect(find(`<input type="button" value="Continue">`).kind).toBe("next")
  })

  test("reads the label from aria-label when the button shows only an icon", () => {
    expect(find(`<button aria-label="Next"><svg></svg></button>`).kind).toBe("next")
  })

  test("returns the element to click", () => {
    const result = find(`<button id="n">Next</button>`)

    expect(result.kind === "next" && result.element.id).toBe("n")
  })
})

describe("findNextButton: buttons that must never be clicked", () => {
  test.each(["Submit", "Submit application", "Apply", "Apply now", "Send", "Finish", "Complete", "Confirm", "Review and submit", "Done"])(
    "reports %s as a submit button",
    (label) => {
      expect(find(`<button>${label}</button>`).kind).toBe("submit")
    },
  )

  test("treats a submit input as a submit button whatever its label says", () => {
    expect(find(`<input type="submit" value="Continue">`).kind).toBe("submit")
  })

  test("stops when a Next button and a submit-like button are both on the page", () => {
    expect(find(`<button>Next</button><button>Submit</button>`).kind).toBe("submit")
  })

  test("ignores Back, Cancel, Previous and Save for later", () => {
    expect(find(`<button>Back</button><button>Cancel</button><button>Previous</button><button>Save for later</button>`).kind).toBe("none")
  })

  test("does not choose 'Continue later' or 'Continue as guest' style buttons", () => {
    expect(find(`<button>Continue later</button>`).kind).toBe("none")
  })
})

describe("findNextButton: buttons that cannot be pressed", () => {
  test("skips a disabled Next button", () => {
    expect(find(`<button disabled>Next</button>`).kind).toBe("none")
  })

  test("skips a button the page marks aria-disabled", () => {
    expect(find(`<button aria-disabled="true">Next</button>`).kind).toBe("none")
  })

  test("skips a hidden button", () => {
    expect(find(`<button hidden>Next</button>`).kind).toBe("none")
  })

  test("reports none when there is no button at all", () => {
    expect(find(`<p>Thanks</p>`).kind).toBe("none")
  })
})

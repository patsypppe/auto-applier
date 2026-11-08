// Tests that the Apply button that opens an application is found, and that look-alikes (filters, social sign-in, the final Submit) are not.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { applyCandidates, findApplyButton } from "./applyButton"

beforeEach(() => {
  document.body.innerHTML = ""
})

// Finds the Apply button on a page made of the given HTML.
function find(html: string) {
  document.body.innerHTML = html
  return findApplyButton(document)
}

describe("findApplyButton: what counts", () => {
  test.each(["Apply", "Apply now", "Apply Now", "Apply for this job", "Apply for this position", "Apply to this job", "Start application", "Start your application", "Apply for job"])(
    "finds a button labelled %s",
    (label) => {
      expect(find(`<button>${label}</button>`).kind).toBe("apply")
    },
  )

  test("finds a link styled as a button, with its address", () => {
    const result = find(`<a href="https://boards.greenhouse.io/acme/jobs/1#app" class="btn">Apply</a>`)

    expect(result.kind === "apply" && result.element.tagName).toBe("A")
  })

  test("reads the label from aria-label", () => {
    expect(find(`<button aria-label="Apply now"><svg></svg></button>`).kind).toBe("apply")
  })

  test("prefers the first one on the page", () => {
    const result = find(`<a id="top" href="/a">Apply now</a><a id="bottom" href="/b">Apply now</a>`)

    expect(result.kind === "apply" && result.element.id).toBe("top")
  })
})

describe("findApplyButton: what does not count", () => {
  test.each(["Apply filters", "Apply coupon", "Applied", "Reapply", "Apply with LinkedIn", "Apply with Indeed", "Apply with Google", "Submit application", "Save job", "Share this job"])(
    "ignores %s",
    (label) => {
      expect(find(`<button>${label}</button>`).kind).toBe("none")
    },
  )

  test("ignores a hidden or disabled button", () => {
    expect(find(`<button hidden>Apply</button><button disabled>Apply</button>`).kind).toBe("none")
  })

  test("ignores a submit input inside a form that has fields, because that is the final submit", () => {
    expect(find(`<form><input name="a"><input type="submit" value="Apply"></form>`).kind).toBe("none")
  })

  test("returns none on a page without one", () => {
    expect(find(`<p>No openings</p>`).kind).toBe("none")
  })
})

describe("applyCandidates", () => {
  test("lists the clickable things with short text and where links lead, numbered", () => {
    document.body.innerHTML = `<a href="/careers/apply-1">Join us</a><button>Learn more</button><p>not clickable</p>`

    expect(applyCandidates(document)).toEqual([
      { index: 0, text: "Join us", href: "/careers/apply-1" },
      { index: 1, text: "Learn more" },
    ])
  })

  test("leaves out hidden, empty, very long and submit-like candidates", () => {
    document.body.innerHTML = `<button hidden>Hidden</button><button></button><button>${"x".repeat(200)}</button><button>Submit application</button><button>Keep</button>`

    expect(applyCandidates(document).map((candidate) => candidate.text)).toEqual(["Keep"])
  })

  test("leaves out sign-in and sign-up buttons", () => {
    document.body.innerHTML = `<button>Sign in</button><button>Log in</button><button>Create account</button><button>Join the team</button>`

    expect(applyCandidates(document).map((candidate) => candidate.text)).toEqual(["Join the team"])
  })

  test("lists at most 40", () => {
    document.body.innerHTML = Array.from({ length: 60 }, (_unused, index) => `<button>B${index}</button>`).join("")

    expect(applyCandidates(document)).toHaveLength(40)
  })
})

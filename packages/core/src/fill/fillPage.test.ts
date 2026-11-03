// Tests the whole fill pipeline on small pages and on the shared fixture application form.
// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import type { Filler, FillResult } from "../filling/types"
import type { Profile } from "../profile/types"
import { DEFAULT_SETUP, fillPage } from "./fillPage"
import { summarizeReports } from "./summary"

const profile: Profile = {
  personal: {
    firstName: "Pranav",
    middleName: "T",
    lastName: "Pattanashetty",
    email: "pranav@example.com",
    phone: "5551234567",
    links: { linkedin: "linkedin.com/in/pranav", github: "github.com/pranav", portfolio: "pranav.dev" },
  },
  experience: [],
  education: [],
  skills: ["TypeScript"],
  answers: { workAuthorization: "Citizen", needsSponsorship: false, isAuthorizedToWork: true },
}

// Puts the HTML in the fake page.
function setPage(html: string): void {
  document.body.innerHTML = html
}

// Returns the current value of the input with the given id.
function valueOf(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value
}

describe("fillPage: filling", () => {
  test("fills text fields from the profile using their labels", async () => {
    setPage(`
      <label for="a">First name</label><input id="a" />
      <label for="b">Last name</label><input id="b" />
      <label for="c">Email</label><input id="c" type="email" />
      <label for="d">Phone</label><input id="d" type="tel" />`)

    await fillPage(document, profile)

    expect([valueOf("a"), valueOf("b"), valueOf("c"), valueOf("d")]).toEqual([
      "Pranav",
      "Pattanashetty",
      "pranav@example.com",
      "5551234567",
    ])
  })

  test("reports the matched key and outcome for every field, in page order", async () => {
    setPage(`<label for="a">First name</label><input id="a" /><label for="b">Email</label><input id="b" />`)

    const reports = await fillPage(document, profile)

    expect(reports.map((report) => [report.profileKey, report.outcome.status])).toEqual([
      ["firstName", "filled"],
      ["email", "filled"],
    ])
  })

  test("fills a radio group and a dropdown in the same pass", async () => {
    setPage(`
      <fieldset><legend>Are you legally authorized to work in the US?</legend>
        <label><input id="yes" type="radio" name="auth" /> Yes</label>
        <label><input id="no" type="radio" name="auth" /> No</label>
      </fieldset>
      <label for="sp">Do you require visa sponsorship?</label>
      <select id="sp"><option value="">Select…</option><option>Yes</option><option>No</option></select>`)

    await fillPage(document, profile)

    expect((document.getElementById("yes") as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById("sp") as HTMLSelectElement).value).toBe("No")
  })

  test("checks a checkbox whose label asks about work authorization", async () => {
    setPage(`<label><input id="box" type="checkbox" /> I am legally authorized to work in the US</label>`)

    await fillPage(document, profile)

    expect((document.getElementById("box") as HTMLInputElement).checked).toBe(true)
  })

  test("uses the full name for a lone 'Name' field", async () => {
    setPage(`<label for="n">Name</label><input id="n" />`)

    await fillPage(document, profile)

    expect(valueOf("n")).toBe("Pranav T Pattanashetty")
  })

  test("leaves 'Name' alone when the page also has first and last name fields", async () => {
    setPage(`
      <label for="n">Name</label><input id="n" />
      <label for="f">First name</label><input id="f" />
      <label for="l">Last name</label><input id="l" />`)

    const reports = await fillPage(document, profile)

    expect(valueOf("n")).toBe("")
    expect(reports[0]?.outcome).toEqual({ status: "unmatched" })
  })

  test("only fills inside the root it is given", async () => {
    setPage(`
      <label for="out">First name</label><input id="out" />
      <div id="form"><label for="in">First name</label><input id="in" /></div>`)

    await fillPage(document.getElementById("form")!, profile)

    expect(valueOf("out")).toBe("")
    expect(valueOf("in")).toBe("Pranav")
  })

  test("returns no reports for a page without fields", async () => {
    setPage("<p>Nothing to fill</p>")

    expect(await fillPage(document, profile)).toEqual([])
  })
})

describe("fillPage: fields it cannot or should not fill", () => {
  test("reports a field it cannot recognise as unmatched and leaves it empty", async () => {
    setPage(`<label for="why">Why do you want to work here?</label><textarea id="why"></textarea>`)

    const reports = await fillPage(document, profile)

    expect(reports[0]?.outcome).toEqual({ status: "unmatched" })
    expect(reports[0]?.profileKey).toBeUndefined()
    expect(valueOf("why")).toBe("")
  })

  test("reports no-value when the profile has nothing for a recognised field", async () => {
    setPage(`<label for="n">Notice period</label><input id="n" />`)

    const reports = await fillPage(document, profile)

    expect(reports[0]).toMatchObject({ profileKey: "noticePeriod", outcome: { status: "no-value", profileKey: "noticePeriod" } })
    expect(valueOf("n")).toBe("")
  })

  test("does not overwrite what is already there", async () => {
    setPage(`<label for="a">First name</label><input id="a" value="Typed already" />`)

    const reports = await fillPage(document, profile)

    expect(reports[0]?.outcome).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(valueOf("a")).toBe("Typed already")
  })

  test("reports a failure when no filler can handle the field", async () => {
    setPage(`<label for="a">First name</label><input id="a" />`)

    const reports = await fillPage(document, profile, { ...DEFAULT_SETUP, fillers: [] })

    expect(reports[0]?.outcome).toEqual({ status: "failed", reason: "Nothing can fill text fields yet" })
  })

  test("turns a filler that throws into a failure with its message", async () => {
    setPage(`<label for="a">First name</label><input id="a" />`)
    const throwing: Filler = {
      canFill: () => true,
      fill: () => {
        throw new Error("boom")
      },
    }

    const reports = await fillPage(document, profile, { ...DEFAULT_SETUP, fillers: [throwing] })

    expect(reports[0]?.outcome).toEqual({ status: "failed", reason: "boom" })
  })
})

describe("fillPage: async fillers", () => {
  test("waits for each filler to finish before starting the next field", async () => {
    setPage(`<label for="a">First name</label><input id="a" name="first_name" /><label for="b">Last name</label><input id="b" name="last_name" />`)
    const log: string[] = []
    const slow: Filler = {
      canFill: () => true,
      async fill(field: FormField): Promise<FillResult> {
        log.push(`start:${field.name}`)
        await new Promise((resolve) => setTimeout(resolve, 20))
        log.push(`end:${field.name}`)
        return { status: "filled" }
      },
    }

    await fillPage(document, profile, { ...DEFAULT_SETUP, fillers: [slow] })

    expect(log).toEqual(["start:first_name", "end:first_name", "start:last_name", "end:last_name"])
  })
})

describe("fillPage: the fixture application form", () => {
  test("fills what it can and flags the rest", async () => {
    const html = readFileSync(join(import.meta.dirname, "../../../../fixtures/simple-application.html"), "utf8")
    setPage(/<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "")

    const reports = await fillPage(document, profile)

    expect(valueOf("first_name")).toBe("Pranav")
    expect(valueOf("last_name")).toBe("Pattanashetty")
    expect(valueOf("email")).toBe("pranav@example.com")
    expect(valueOf("phone")).toBe("5551234567")
    expect(valueOf("linkedin")).toBe("linkedin.com/in/pranav")
    expect(valueOf("website")).toBe("pranav.dev")
    expect((document.getElementById("auth_yes") as HTMLInputElement).checked).toBe(true)
    expect((document.getElementById("sponsorship") as HTMLSelectElement).value).toBe("no")

    const statusById = Object.fromEntries(reports.map((report) => [report.field.element.id, report.outcome.status]))
    expect(statusById).toEqual({
      first_name: "filled",
      last_name: "filled",
      email: "filled",
      phone: "filled",
      linkedin: "filled",
      website: "filled",
      auth_yes: "filled",
      sponsorship: "filled",
      notice: "no-value",
      salary: "no-value",
      resume: "unmatched",
      why: "unmatched",
      privacy: "unmatched",
    })
    expect(summarizeReports(reports)).toEqual({
      filled: 8,
      aiFilled: 0,
      drafted: 0,
      skipped: 0,
      failed: 0,
      unmatched: 3,
      noValue: 2,
    })
  })
})

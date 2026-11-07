// Tests that a field the page cleared or marked invalid after we filled it is reported as failed, with the page's own reason.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { discoverFields } from "../fields/discoverFields"
import type { FieldReport } from "../fill/fillPage"
import { checkFilled } from "./verifyFilled"

// Builds a report saying the field was filled.
function filled(html: string): FieldReport[] {
  document.body.innerHTML = html
  return discoverFields(document).map((field) => ({ field, outcome: { status: "filled" as const } }))
}

describe("checkFilled", () => {
  test("keeps a filled field whose value is still there", () => {
    const reports = filled(`<label for="a">Name</label><input id="a" value="Pranav">`)

    expect(checkFilled(reports)[0]?.outcome.status).toBe("filled")
  })

  test("fails a filled text field the page has emptied again", () => {
    const reports = filled(`<label for="a">Name</label><input id="a" value="">`)

    const [report] = checkFilled(reports)

    expect(report?.outcome).toMatchObject({ status: "failed", reason: expect.stringMatching(/cleared/i) })
  })

  test("fails a filled field the page marked invalid and keeps the page's message", () => {
    const reports = filled(`<label for="e">Email</label><input id="e" value="x" aria-invalid="true" aria-describedby="m"><p id="m">Enter a valid email</p>`)

    const [report] = checkFilled(reports)

    expect(report?.outcome).toMatchObject({ status: "failed", code: "page-rejected", reason: expect.stringContaining("Enter a valid email") })
  })

  test("leaves skipped, unmatched and failed reports as they were", () => {
    document.body.innerHTML = `<label for="a">A</label><input id="a">`
    const field = discoverFields(document)[0]!
    const reports: FieldReport[] = [
      { field, outcome: { status: "unmatched" } },
      { field, outcome: { status: "skipped", reason: "already had a value" } },
    ]

    expect(checkFilled(reports)).toEqual(reports)
  })

  test("does not mind an emptied select or radio, only text fields", () => {
    const reports = filled(`<label for="s">S</label><select id="s"><option value="">-</option><option>A</option></select>`)

    expect(checkFilled(reports)[0]?.outcome.status).toBe("filled")
  })
})

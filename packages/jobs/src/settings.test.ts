// Tests that parseSettings fills in sensible defaults for each status and explains each mistake in a settings file.
import { describe, expect, test } from "vitest"
import { parseSettings } from "./settings"

const MINIMAL = { workAuth: { status: "f1-opt" }, filters: { roles: ["data scientist"] } }

describe("parseSettings: defaults", () => {
  test("fills in the filters and a student's work authorization from a minimal file", () => {
    expect(parseSettings(MINIMAL)).toEqual({
      workAuth: { status: "f1-opt", needsSponsorshipLater: true, stemDegree: false, clearance: "none" },
      filters: {
        roles: ["data scientist"],
        hideBlocked: true,
        hideLikelyBlocked: false,
        includeAbroad: false,
        locations: [],
        remoteOnly: false,
        levels: ["intern", "new-grad", "entry"],
        excludeTitleWords: ["senior", "staff", "principal", "manager", "director"],
        postedWithinDays: 90,
        maxYearsRequired: 2,
        companies: { include: [], exclude: [] },
        minScore: 0,
      },
    })
  })

  test("takes a citizen to need no sponsorship and to be able to obtain a clearance", () => {
    const settings = parseSettings({ ...MINIMAL, workAuth: { status: "citizen" } })

    expect(settings.workAuth).toEqual({ status: "citizen", needsSponsorshipLater: false, stemDegree: false, clearance: "can-obtain" })
  })

  test("keeps what the file says over the defaults", () => {
    const settings = parseSettings({
      workAuth: { status: "f1-opt", stemDegree: true, needsSponsorshipLater: false },
      filters: { roles: ["analyst"], hideLikelyBlocked: true, postedWithinDays: 7 },
    })

    expect(settings.workAuth).toMatchObject({ stemDegree: true, needsSponsorshipLater: false })
    expect(settings.filters).toMatchObject({ hideLikelyBlocked: true, postedWithinDays: 7 })
  })
})

describe("parseSettings: mistakes", () => {
  test("names an unknown status and lists the allowed ones", () => {
    expect(() => parseSettings({ ...MINIMAL, workAuth: { status: "student" } })).toThrow(
      "workAuth.status must be one of citizen, permanent-resident, f1-cpt, f1-opt, f1-stem-opt, h1b, other-needs-sponsorship.",
    )
  })

  test("asks for at least one role", () => {
    expect(() => parseSettings({ workAuth: { status: "citizen" }, filters: { roles: [] } })).toThrow(
      'filters.roles must list at least one job title keyword, such as "data analyst".',
    )
  })

  test("names a level it does not know", () => {
    expect(() => parseSettings({ ...MINIMAL, filters: { roles: ["analyst"], levels: ["junior"] } })).toThrow(
      "filters.levels may only use intern, new-grad, entry, mid, senior, staff.",
    )
  })

  test("lists every mistake at once, one per line", () => {
    expect(() => parseSettings({ workAuth: {}, filters: { roles: [], minScore: 150 } })).toThrow(
      [
        "workAuth.status must be one of citizen, permanent-resident, f1-cpt, f1-opt, f1-stem-opt, h1b, other-needs-sponsorship.",
        'filters.roles must list at least one job title keyword, such as "data analyst".',
        "filters.minScore must be a number from 0 to 100.",
      ].join("\n"),
    )
  })

  test("asks for a number of years that is not negative", () => {
    expect(() => parseSettings({ ...MINIMAL, filters: { roles: ["analyst"], maxYearsRequired: -1 } })).toThrow(
      "filters.maxYearsRequired must be a number of years, 0 or more.",
    )
  })

  test("refuses a file that is not an object", () => {
    expect(() => parseSettings([])).toThrow("The settings file must be an object with workAuth and filters.")
  })
})

// Tests that parseSettings fills in sensible defaults for each status and explains each mistake in a settings file.
import { describe, expect, test } from "vitest"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadSettingsIfAny, parseSettings, workAuthDefaults } from "./settings"

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
        workplaces: [],
        jobTypes: [],
        excludeTitleWords: ["senior", "staff", "principal", "manager", "director"],
        postedWithinDays: 90,
        maxYearsRequired: 2,
        minYearlyPay: 0,
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

describe("workAuthDefaults", () => {
  test("gives students and visa holders sponsorship later, and only citizens a clearance they can obtain", () => {
    expect(workAuthDefaults("f1-opt")).toEqual({ needsSponsorshipLater: true, clearance: "none" })
    expect(workAuthDefaults("h1b")).toEqual({ needsSponsorshipLater: true, clearance: "none" })
    expect(workAuthDefaults("permanent-resident")).toEqual({ needsSponsorshipLater: false, clearance: "none" })
    expect(workAuthDefaults("citizen")).toEqual({ needsSponsorshipLater: false, clearance: "can-obtain" })
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

  test("reads the wanted workplaces, job types and lowest yearly pay, which hide nothing by default", () => {
    const base = { workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } }
    const chosen = parseSettings({ ...base, filters: { ...base.filters, workplaces: ["remote"], jobTypes: ["intern"], minYearlyPay: 90000 } }).filters

    expect([chosen.workplaces, chosen.jobTypes, chosen.minYearlyPay]).toEqual([["remote"], ["intern"], 90000])
    expect(parseSettings(base).filters).toMatchObject({ workplaces: [], jobTypes: [], minYearlyPay: 0 })
  })

  test("names a workplace, job type or pay it cannot use", () => {
    const filters = { roles: ["data analyst"], workplaces: ["office"], jobTypes: ["gig"], minYearlyPay: -5 }

    expect(() => parseSettings({ workAuth: { status: "f1-opt" }, filters })).toThrow(
      "filters.workplaces may only use remote, hybrid, onsite.\nfilters.jobTypes may only use full-time, part-time, contract, intern, temporary.\nfilters.minYearlyPay must be a number of dollars, 0 or more.",
    )
  })

  test("reads the user's degree, which is unset unless the file gives it", () => {
    const base = { workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } }

    expect(parseSettings({ ...base, filters: { ...base.filters, myDegree: "master" } }).filters.myDegree).toBe("master")
    expect(parseSettings(base).filters.myDegree).toBeUndefined()
    expect(() => parseSettings({ ...base, filters: { ...base.filters, myDegree: "masters" } })).toThrow("filters.myDegree must be one of associate, bachelor, master, phd.")
  })

  test("refuses a file that is not an object", () => {
    expect(() => parseSettings([])).toThrow("The settings file must be an object with workAuth and filters.")
  })
})

describe("loadSettingsIfAny", () => {
  test("returns nothing when there is no settings file yet, and still refuses a broken one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "settings-"))
    await writeFile(join(dir, "bad.json"), JSON.stringify({ workAuth: { status: "student" }, filters: { roles: ["analyst"] } }))

    expect(await loadSettingsIfAny(join(dir, "settings.json"))).toBeUndefined()
    await expect(loadSettingsIfAny(join(dir, "bad.json"))).rejects.toThrow("workAuth.status must be one of")
  })
})

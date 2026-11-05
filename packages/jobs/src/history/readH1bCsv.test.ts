// Tests that readH1bCsv adds up a USCIS H-1B Employer Data Hub file into approvals per employer name.
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { readH1bCsv } from "./readH1bCsv"

const SAMPLE = join(import.meta.dirname, "../../test/fixtures/uscis-h1b-sample.csv")

describe("readH1bCsv", () => {
  test("adds up every approval measure, and new employment approvals on their own, per normalized name", async () => {
    const history = await readH1bCsv(SAMPLE)

    expect(history.fiscalYear).toBe(2026)
    expect(history.employers["openai opco"]).toEqual({ name: "OPENAI OPCO LLC", approvals: 424, newEmploymentApprovals: 121, denials: 9 })
  })

  test("joins filings under names that normalize the same, such as STRIPE LLC and STRIPE INC", async () => {
    const history = await readH1bCsv(SAMPLE)

    expect(history.employers.stripe).toEqual({ name: "STRIPE LLC", approvals: 340, newEmploymentApprovals: 152, denials: 6 })
  })

  test("reads numbers written with commas and skips rows with no employer name", async () => {
    const history = await readH1bCsv(SAMPLE)

    expect(history.employers[""]).toBeUndefined()
    expect(Object.keys(history.employers).sort()).toEqual(["axon enterprise", "axon networks", "notion labs", "openai opco", "space exploration technologies", "stripe"])
  })

  test("refuses a file without the columns it needs", async () => {
    await expect(readH1bCsv(join(import.meta.dirname, "../../test/fixtures/simplify-listings.json"))).rejects.toThrow(
      /does not look like a USCIS H-1B Employer Data Hub file: it has no "Employer \(Petitioner\) Name" column/,
    )
  })
})

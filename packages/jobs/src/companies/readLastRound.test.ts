// Tests that readLastRound turns LastRound's ATS company directory into boards, using a saved slice of the real file.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { readLastRound } from "./readLastRound"

const SLICE = readFileSync(join(import.meta.dirname, "../../test/fixtures/lastround-ats-directory.csv"), "utf8")
const HEADER = "ats_vendor,company_name,board_slug,last_crawled"

describe("readLastRound", () => {
  test("reads every row of the saved slice as a board with the company's real name", () => {
    const { companies, skipped } = readLastRound(SLICE)

    expect(companies).toHaveLength(20)
    expect(skipped).toBe(0)
    expect(companies[0]).toEqual({ name: "0g Labs", ats: "ashby", slug: "0g", sources: ["lastround"] })
  })

  test("keeps commas inside quoted company names", () => {
    const { companies } = readLastRound(SLICE)

    expect(companies.find((company) => company.slug === "80000hours")?.name).toBe("80,000 Hours")
    expect(companies.find((company) => company.slug === "arcr")?.name).toBe("Aaron Riechert Carpol & Riffle, APC")
  })

  test("lowercases slugs, the way the other lists store them", () => {
    const { companies } = readLastRound(SLICE)

    expect(companies.filter((company) => company.ats === "lever").map((company) => company.slug)).toContain("academy")
  })

  test("splits the slice by job site", () => {
    const { companies } = readLastRound(SLICE)
    const count = (ats: string) => companies.filter((company) => company.ats === ats).length

    expect([count("ashby"), count("greenhouse"), count("lever")]).toEqual([6, 6, 8])
  })

  test("skips rows on job sites the feed does not read and rows with no slug, and counts them", () => {
    const text = [HEADER, 'workable,"Acme",acme,2026-08-01', 'greenhouse,"No Slug",,2026-08-01', 'greenhouse,"Stripe",stripe,2026-08-01'].join("\n")

    expect(readLastRound(text)).toEqual({
      companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe", sources: ["lastround"] }],
      skipped: 2,
    })
  })

  test("names a board after its slug when the company name is blank", () => {
    const text = `${HEADER}\r\nashby,"",ramp,2026-07-12\r\n`

    expect(readLastRound(text).companies).toEqual([{ name: "ramp", ats: "ashby", slug: "ramp", sources: ["lastround"] }])
  })

  test("refuses a file whose columns have changed", () => {
    expect(() => readLastRound("vendor,name,slug\ngreenhouse,Stripe,stripe")).toThrow(
      "The LastRound directory has no ats_vendor column. Its columns are now: vendor, name, slug.",
    )
  })
})

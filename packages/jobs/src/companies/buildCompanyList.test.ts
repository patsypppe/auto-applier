// Tests that mergeCompanies joins company lists into one entry per board and lets the hand-kept list win.
import { describe, expect, test } from "vitest"
import type { Company } from "../types"
import { mergeCompanies, readAggregatorList } from "./buildCompanyList"

// Builds a company entry with only the details a test cares about.
function company(details: Partial<Company> & Pick<Company, "ats" | "slug">): Company {
  return { name: details.slug, sources: ["test"], ...details }
}

describe("readAggregatorList", () => {
  test("turns a list of slugs into companies named after the slug", () => {
    expect(readAggregatorList("lever", ["10up-2", " Plaid "], "aggregator")).toEqual([
      { name: "10up-2", ats: "lever", slug: "10up-2", sources: ["aggregator"] },
      { name: "plaid", ats: "lever", slug: "plaid", sources: ["aggregator"] },
    ])
  })

  test("refuses a file that is not a list of slugs", () => {
    expect(() => readAggregatorList("lever", { slugs: [] }, "aggregator")).toThrow(
      "The aggregator lever file is not a list of board names.",
    )
  })
})

describe("mergeCompanies", () => {
  test("keeps one entry per board and records every list it came from", () => {
    const fromSimplify = [company({ ats: "greenhouse", slug: "stripe", name: "Stripe", sources: ["simplify-new-grad"] })]
    const fromAggregator = [company({ ats: "greenhouse", slug: "Stripe", sources: ["aggregator"] })]

    expect(mergeCompanies([fromSimplify, fromAggregator], [])).toEqual([
      { name: "Stripe", ats: "greenhouse", slug: "stripe", sources: ["simplify-new-grad", "aggregator"] },
    ])
  })

  test("treats the same slug on different job sites as different boards", () => {
    const merged = mergeCompanies([[company({ ats: "greenhouse", slug: "acme" }), company({ ats: "lever", slug: "acme" })]], [])

    expect(merged.map((entry) => `${entry.ats}:${entry.slug}`)).toEqual(["greenhouse:acme", "lever:acme"])
  })

  test("prefers a real name over one that is only the slug", () => {
    const fromAggregator = [company({ ats: "ashby", slug: "ramp" })]
    const fromSimplify = [company({ ats: "ashby", slug: "ramp", name: "Ramp" })]

    expect(mergeCompanies([fromAggregator, fromSimplify], [])[0]!.name).toBe("Ramp")
  })

  test("lets the hand-kept list rename a board and add new ones", () => {
    const listed = [company({ ats: "lever", slug: "palantir", name: "Palantir Technologies" })]
    const extra = [
      company({ ats: "lever", slug: "palantir", name: "Palantir", sources: ["extra"] }),
      company({ ats: "ashby", slug: "openai", name: "OpenAI", sources: ["extra"] }),
    ]

    expect(mergeCompanies([listed], extra)).toEqual([
      { name: "Palantir", ats: "lever", slug: "palantir", sources: ["test", "extra"] },
      { name: "OpenAI", ats: "ashby", slug: "openai", sources: ["extra"] },
    ])
  })

  test("keeps the EU region of a Lever board", () => {
    const merged = mergeCompanies([[company({ ats: "lever", slug: "cirrus", region: "eu" })]], [])

    expect(merged[0]!.region).toBe("eu")
  })
})

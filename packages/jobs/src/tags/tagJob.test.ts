// Tests that tagJob finds work-authorization statements with their evidence, and avoids the false matches found in research.
import { describe, expect, test } from "vitest"
import { tagJob } from "./tagJob"

// Returns just the tag names found in a US job with the given text.
function tagsOf(description: string, country: "US" | "other" | undefined = "US"): string[] {
  return tagJob({ description, country }).map((found) => found.tag)
}

describe("tagJob: sponsorship", () => {
  test.each([
    ["We are unable to provide visa sponsorship or support visa transfers."],
    ["Must be authorized to work in the US without sponsorship."],
    ["Work Authorization: Must be authorized to work in the U.S. (no visa sponsorship)"],
    ["Welocalize does not sponsor VISAs at this time."],
    ["We are not able to sponsor visas for this role."],
  ])("reads %s as no sponsorship", (text) => {
    expect(tagsOf(text)).toEqual(["no-sponsorship"])
  })

  test("reads 'now or in the future' as no sponsorship later either", () => {
    expect(tagsOf("Candidates must not require visa sponsorship now or in the future.")).toEqual(["no-future-sponsorship"])
  })

  test("reads an offer of sponsorship as sponsors", () => {
    expect(tagsOf("We will sponsor H-1B visas for this role.")).toEqual(["sponsors"])
  })

  test("never reads a refusal as an offer", () => {
    expect(tagsOf("We are unable to provide visa sponsorship for this role.")).not.toContain("sponsors")
  })

  test.each([
    ["You will be technical sponsor and thought-leader to a select number of customers."],
    ["An active clearance is not required at the time of hire, and OpenAI will sponsor the clearance process."],
    ["You will identify sponsors and partners for our events."],
  ])("does not read the business sense of 'sponsor' in %s as anything", (text) => {
    expect(tagsOf(text)).not.toContain("sponsors")
    expect(tagsOf(text)).not.toContain("no-sponsorship")
  })
})

describe("tagJob: citizenship, U.S. persons and clearances", () => {
  test.each([["Citizenship: U.S. Citizenship required"], ["Must be a U.S. citizen and reside in the U.S."], ["US citizenship required due to government contract obligations"]])(
    "reads %s as citizens only",
    (text) => {
      expect(tagsOf(text)).toContain("citizen-only")
    },
  )

  test("reads a rule that names green card holders too as U.S. persons, not citizens only", () => {
    const text = "Due to U.S. export control regulations, we can only hire U.S. Persons (U.S. citizens, Green Card holders, lawful permanent residents, or individuals granted asylum or refugee status)."

    expect(tagsOf(text)).toEqual(["us-person"])
  })

  test("reads the SpaceX ITAR paragraph as U.S. persons", () => {
    const text = "ITAR REQUIREMENTS: To conform to U.S. Government export regulations, applicant must be a (i) U.S. citizen or national, (ii) U.S. lawful, permanent resident (aka green card holder), (iii) Refugee under 8 U.S.C. § 1157, or (iv) Asylee under 8 U.S.C. § 1158."

    expect(tagsOf(text)).toEqual(["us-person"])
  })

  test.each([["Active TS/SCI security clearance"], ["Eligible to obtain and maintain an active U.S. Secret security clearance."], ["Clearance Level: Top Secret, Must Have Clearance to Start"]])(
    "reads %s as needing a clearance",
    (text) => {
      expect(tagsOf(text)).toContain("clearance")
    },
  )

  test("reads a Public Trust requirement as unclear, since it is a background check and not a clearance", () => {
    expect(tagsOf("Clearance Level: Must be able to obtain Public Trust clearance")).toEqual(["unclear"])
  })

  test("reads the discretionary export-control boilerplate as unclear, not as a rule", () => {
    const text = "If access to export-controlled technology or source code is required for performance of job duties, it is within Employer's discretion whether to apply for a U.S. government license."

    expect(tagsOf(text)).toEqual(["unclear"])
  })

  test("does not read citizenship in an equal-opportunity list as a rule", () => {
    expect(tagsOf("We hire regardless of race, color, religion, national origin, citizenship, marital status or disability.")).toEqual(["not-stated"])
  })
})

describe("tagJob: OPT, CPT and E-Verify", () => {
  test("reads a welcome for OPT students", () => {
    expect(tagsOf("F-1 students on OPT or STEM OPT are welcome to apply.")).toEqual(["opt-cpt-welcome"])
  })

  test.each([["Cyber Penetration Teams (CPT), software developers and cloud engineers"], ["You are passionate about system optimization."], ["A strong ear for natural phrasing."]])(
    "does not read %s as OPT or CPT",
    (text) => {
      expect(tagsOf(text)).toEqual(["not-stated"])
    },
  )

  test.each([["Notice of E-Verify Participation"], ["The company uses E-Verify to confirm the identity and employment eligibility of all new hires."]])(
    "reads %s as E-Verify",
    (text) => {
      expect(tagsOf(text)).toEqual(["e-verify"])
    },
  )

  test("does not read E-Verify listed as a skill as the employer's own E-Verify use", () => {
    expect(tagsOf("Experience supporting EEO-1, VETS-4212, OFCCP / AAP, I-9 / E-Verify, or similar filings")).toEqual(["not-stated"])
  })

  test("does not read U.S. Citizenship and Immigration Services as a citizenship rule", () => {
    expect(tagsOf("E-Verify is operated by the U.S. Citizenship and Immigration Services.")).toEqual(["e-verify"])
  })
})

describe("tagJob: sentences found in the hand check of the full feed", () => {
  test("reads a hedged citizenship sentence as unclear, not as citizens only", () => {
    const text = "For purposes of transparency, U.S. Citizenship may be required for some positions with a government clearance and certain other restricted positions."

    expect(tagsOf(text)).not.toContain("citizen-only")
    expect(tagsOf(text)).toContain("unclear")
  })

  test("reads a request to disclose a sponsorship need as unclear, not as a refusal", () => {
    const text = "Candidates must disclose any current or future need for employment-based immigration sponsorship (including, but not limited to, OPT, STEM OPT, or visa sponsorship) before an offer."

    expect(tagsOf(text)).toEqual(["unclear"])
  })

  test("reads 'Must be US Citizenship' as citizens only", () => {
    expect(tagsOf("- Must be US Citizenship")).toEqual(["citizen-only"])
  })

  test("reads a government clearance that requires citizenship as both", () => {
    const tags = tagsOf("Must be eligible to obtain and maintain a US Government clearance (requires US citizenship).")

    expect(tags).toContain("clearance")
    expect(tags).toContain("citizen-only")
  })

  test("reads security clearances in the plural as a clearance", () => {
    expect(tagsOf("Positions at STR require employees to obtain national security clearances.")).toContain("clearance")
  })

  test("reads 'We do sponsor visas!' as sponsors", () => {
    expect(tagsOf("Visa sponsorship: We do sponsor visas!")).toEqual(["sponsors"])
  })

  test("reads citizenship, permanent residency or refugee status as U.S. persons", () => {
    expect(tagsOf("U.S. Citizenship, Lawful Permanent Residency, or Refugee/Asylee Status Required")).toEqual(["us-person"])
  })
})

describe("tagJob: evidence and jobs abroad", () => {
  test("gives each tag the sentence it came from and the sentences around it", () => {
    const [found] = tagJob({ description: "About us.\nWe are unable to sponsor visas. Apply today.", country: "US" })

    expect(found).toEqual({
      tag: "no-sponsorship",
      evidence: "We are unable to sponsor visas.",
      context: "About us. We are unable to sponsor visas. Apply today.",
    })
  })

  test("lists one tag of each kind, from its first sentence", () => {
    const tags = tagJob({ description: "No visa sponsorship. We do not sponsor visas.", country: "US" })

    expect(tags.map((found) => found.evidence)).toEqual(["No visa sponsorship."])
  })

  test("says not stated when nothing is said", () => {
    expect(tagJob({ description: "Build data pipelines in Python.", country: "US" })).toEqual([
      { tag: "not-stated", evidence: "", context: "" },
    ])
  })

  test("gives a job abroad no restriction tags, since the rules it states are about another country", () => {
    expect(tagsOf("We are unable to provide work visa sponsorship for this position in accordance with Singapore's employment regulations.", "other")).toEqual(["not-stated"])
  })

  test("skips a sentence about another country's work rules even on a US job", () => {
    expect(tagsOf("To be eligible, candidates must be authorized to work in Canada; visa sponsorship is not available for this role.")).toEqual(["not-stated"])
  })
})

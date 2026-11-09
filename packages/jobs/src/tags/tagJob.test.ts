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

  test("reads E-Verify used only in certain locations apart from E-Verify used for every hire", () => {
    expect(tagsOf("Additionally, Twilio participates in the E-Verify program in certain locations, as required by law.")).toEqual(["e-verify-some-places"])
    expect(tagsOf("As required by law, we will verify the identity and employment authorization of all new employees using the E-Verify system.")).toEqual(["e-verify"])
  })

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

  test.each([["We aren't able to sponsor visas for this role."], ["This role isn't eligible for visa sponsorship."], ["We can't sponsor work visas."]])(
    "reads the short form %s as no sponsorship",
    (text) => {
      expect(tagsOf(text)).toEqual(["no-sponsorship"])
    },
  )

  test("does not read 'not for every role' as a refusal, as in Anthropic's sponsorship note", () => {
    const text = "Visa sponsorship: We do sponsor visas! However, we aren't able to successfully sponsor visas for every role and every candidate."

    expect(tagsOf(text)).toContain("sponsors")
    expect(tagsOf(text)).not.toContain("no-sponsorship")
  })

  test.each([
    ["- Visa sponsorship: we sponsor visas (H1B, TN, etc.) for candidates who are a good fit."],
    ["Visa sponsorship and green card support for qualified candidates."],
  ])("reads %s as sponsors", (text) => {
    expect(tagsOf(text)).toEqual(["sponsors"])
  })

  test("does not call a skill line about export controls unclear", () => {
    expect(tagsOf("- Experience with sovereign AI deployments, regulatory compliance (CTA, export controls), and government partnerships")).toEqual([
      "not-stated",
    ])
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

describe("tagJob: wordings found in the real-data check", () => {
  test("does not read sponsorship for an export license as a visa refusal, as in Cloudflare's notice", () => {
    const text = "Please note that any offer of employment may be conditioned on your authorization to receive software or technology controlled under these U.S. export laws without sponsorship for an export license."

    expect(tagsOf(text)).not.toContain("no-sponsorship")
  })

  test.each([
    ["Preference for a Top Secret clearance."],
    ["Ability to obtain a Secret or higher security clearance is preferred; a clearance is not required for this role."],
    ["An active Secret clearance is a plus."],
    ["In addition to the base salary, this position is eligible for a government clearance differential."],
  ])("does not read %s as a clearance requirement", (text) => {
    expect(tagsOf(text)).not.toContain("clearance")
  })

  test.each([
    ["- The ability to obtain a U.S. Government security clearance (active clearance preferred)."],
    ["Active Top-Secret Clearance, preferred with SCI eligibility"],
  ])("still reads %s as a clearance, since only part of it is preferred", (text) => {
    expect(tagsOf(text)).toContain("clearance")
  })

  test("still reads a required clearance next to a preferred one", () => {
    expect(tagsOf("Active Secret clearance required, TS/SCI preferred.")).toContain("clearance")
  })

  test.each([["TS clearance"], ["- Active TS clearance"], ["Must possess an active Secret level clearance; Top Secret preferred"]])("reads the short requirement %s as a clearance", (text) => {
    expect(tagsOf(text)).toContain("clearance")
  })

  test.each([["- U.S. Citizenship."], ["US Citizenship"], ["Citizen with the ability to obtain a Security Clearance"]])(
    "reads the bare requirement line %s as citizens only",
    (text) => {
      expect(tagsOf(text)).toContain("citizen-only")
    },
  )

  test("reads temporary visas such as F-1 named as not eligible as a rule against visa holders", () => {
    const text = "Individuals with temporary visas such as E, F-1, H-1, H-2, L, B, J, or TN or who need sponsorship for work authorization now or in the future, are not eligible for hire."

    expect(tagsOf(text)).toContain("no-visa-holders")
  })

  test("does not read a student welcome as a rule against visa holders", () => {
    expect(tagsOf("F-1 students on OPT are eligible and encouraged to apply.")).not.toContain("no-visa-holders")
  })

  test("reads 'unable to offer employment to those who require sponsorship' as no sponsorship", () => {
    const text = "At this time, we are unable to offer employment for individuals located outside of the United States and/or those who require sponsorship for employment visa status (e.g., H-1B visa status)."

    expect(tagsOf(text)).toContain("no-sponsorship")
  })

  test("reads 'Visa Sponsorship: H1B Available' as sponsors", () => {
    expect(tagsOf("Visa Sponsorship: H1B Available")).toEqual(["sponsors"])
  })

  test.each([
    ["Be either a US citizen or Permanent Resident due to the work we do", ["us-person"]],
    ["United States Citizenship is a strict minimum requirement", ["citizen-only"]],
    ["Due to federal contract requirements, United States Citizenship and position appropriate security clearance is required", ["citizen-only", "clearance"]],
    ["Please note that sponsorship of new applicants for employment authorization, or any other immigration-related support, is not available for this position at this time", ["no-sponsorship"]],
    ["No immigration sponsorship or transfer available for this role", ["no-sponsorship"]],
    ["Active TS SCI Clearance", ["clearance"]],
    ["Required Clearance: Secret", ["clearance"]],
    ["Optional full visa sponsorship and relocation support to either Australia or the US", ["sponsors"]],
    ["Must not require visa sponsorship or have work authorization based on OPT or CPT", ["no-sponsorship", "no-visa-holders"]],
  ])("reads the real sentence %s", (text, tags) => {
    expect(tagsOf(text).sort()).toEqual([...tags].sort())
  })

  test("does not read a wished-for or optional clearance as a rule, or a public trust line as a clearance", () => {
    expect(tagsOf("Ideally you hold an active TS/SCI clearance.")).toEqual(["not-stated"])
    expect(tagsOf("Active or previously held TS/SCI clearance (preferred but not required)")).toEqual(["not-stated"])
    expect(tagsOf("Required Clearance: Public Trust")).not.toContain("clearance")
  })

  test("does not read citizenship that is not required as a citizens-only rule", () => {
    expect(tagsOf("U.S. citizenship is not required for this role")).not.toContain("citizen-only")
  })

  test("does not read visa sponsorship named as a duty or a skill as an offer", () => {
    expect(tagsOf("Manage immigration programs, including visa sponsorship and related processes")).not.toContain("sponsors")
    expect(tagsOf("Working knowledge of US employment law and work authorization, including visa sponsorship and renewals.")).not.toContain("sponsors")
    expect(tagsOf("Relocation assistance is provided for those willing to relocate including visa sponsorship where applicable.")).toContain("sponsors")
  })
})

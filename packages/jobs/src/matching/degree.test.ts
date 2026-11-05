// Tests that degreeRequired finds the lowest degree a posting requires, in wordings from real postings, and leaves out
// degrees that are only preferred.
import { describe, expect, test } from "vitest"
import { degreeRequired } from "./degree"

// Returns the degree read from a posting with the given text and a plain title.
function degreeOf(text: string, title = "Data Scientist"): string | undefined {
  return degreeRequired(text, title)
}

describe("degreeRequired", () => {
  test.each([
    ["Bachelor's degree in Computer Science, Computer Engineering, Electrical Engineering, or a related field", "bachelor"],
    ["- B.S. in a quantitative field", "bachelor"],
    ["Master's degree in Computer Science or related field and relevant experience", "master"],
    ["PhD in Computer Science, Electrical Engineering, or a related field", "phd"],
    ["Currently pursuing a PhD in Machine Learning or a related field.", "phd"],
    ["Advanced degree in a quantitative field (math, statistics, physics, financial engineering, CS)", "master"],
    ["Master's degree with 7+ years of experience, or PhD with 3+ years of experience, in data science", "master"],
    ["Ph.D or thesis-based Master's degree in Electrical Engineering, Control, Robotics", "master"],
    ["Bachelor's or Master's degree in Computer Science, Math, Electrical Engineering", "bachelor"],
  ])("reads %s as %s", (text, degree) => {
    expect(degreeOf(text)).toBe(degree)
  })

  test("takes the lowest degree the posting names, since a higher one is usually listed as a plus", () => {
    const text = "Bachelor's degree in Computer Science, Computer Engineering, Electrical Engineering, or a related field\nMS or PhD in Electrical Engineering or Computer Engineering"

    expect(degreeOf(text)).toBe("bachelor")
  })

  test("leaves out a degree that is only preferred, in the same phrase or under a preferred heading", () => {
    expect(degreeOf("- Bachelor’s degree in Computer Science or related field (Master’s preferred)")).toBe("bachelor")
    expect(degreeOf("Bachelor’s degree preferred or equivalent relevant experience")).toBeUndefined()
    expect(degreeOf("What you bring:\n- 2+ years of Python\nPreferred Qualifications:\n- PhD in Statistics")).toBeUndefined()
    expect(degreeOf("Nice to have\nPhD in Statistics\nRequirements\nMaster's degree in Statistics")).toBe("master")
  })

  test.each([
    ["MS with 4 years or more or PhD with 2 years or more of relevant experience in computer science", "master"],
    ["- BS + 8 years, MS + 5 years, or PhD + 3 years of experience in navigation, aerospace/GNC, robotics", "bachelor"],
    ["Master/PhD degree in math, computer science, engineering, or other related fields.", "master"],
    ["Minimum of 5 years of industry experience with a PhD.", "phd"],
    ["Juris doctorate required.", "phd"],
  ])("reads the real-data line %s as %s", (text, degree) => {
    expect(degreeOf(text)).toBe(degree)
  })

  test.each([
    ["Experience with state estimation and multi-target tracking algorithms (e.g., JPDA, MHT, or PHD filters)."],
    ["Kinetic Systems is a Stanford PhD spinout whose mission is to advance frontier AI models."],
    ["A note for PhD students: we encourage you to complete your PhD."],
    ["Join a team of engineers, physicians, PhD’s, creatives, and technologists."],
    ["You don't need: a PhD."],
    ["A PhD is typical but not required if you've found another way to go deep."],
    ["Strong candidates have extensive experience (5+ years), often including a PhD"],
    ["8+ years of product management, with 2+ at staff level owning a roadmap end-to-end (or 6+ years with a PhD/research background in ML)"],
    ["- Spandan Madan (CTO & Co-founder): PhD in Computer Science from Harvard, designed AI models"],
    ["We spun out of the Stanford PhD program in 2025 and are backed by General Catalyst."],
    ["Partner on experimental design, data types, and R&D workflows with PhD-level researchers"],
  ])("does not read %s as requiring a PhD", (text) => {
    expect(degreeOf(text)).toBeUndefined()
  })

  test.each([
    ["Master or PhD degree in math, physics, computer science, engineering, or other related disciplines", "master"],
    ["PhD (or BS/MS degree with equivalent level of experience) in protein biochemistry, molecular biology", undefined],
    ["Required: Associate's Degree or higher. Bachelor's degree strongly preferred.", "associate"],
    ["- Research Excellence: A PhD (preferred) or Master’s in CS/Robotics with a significant publication record", "master"],
    ["Deep expertise (a PhD, or comparable experience) in materials science or a closely related discipline", undefined],
    ["- Proven Tenure: PhD in computer science, machine learning, or a related field, or 5+ years of equivalent experience", undefined],
    ["MS (3 + years industry experience) or PhD in (0- 2 years industry experience), Molecular Biology, Biochemistry", "master"],
    ["Strong background in machine learning and/or robot learning (e.g. a PhD in a relevant area)", undefined],
    ["• You hold a PhD / master in AI / data science.", "master"],
    [" - MS: 7–12+ years of industry experience\n - PhD: 5–9+ years of industry experience", "master"],
  ])("reads the second-sample line %s as %s", (text, degree) => {
    expect(degreeOf(text)).toBe(degree)
  })

  test("reads 'Pursuing an undergraduate or Masters degree' as a bachelor's", () => {
    expect(degreeOf("Pursuing an undergraduate or Masters degree in a quantitative field (e.g., statistics, economics)")).toBe("bachelor")
  })

  test.each([
    ["Strong grasp of data governance (stewardship, quality, lineage, master/reference data) and key regulatory frameworks"],
    ["You have deep expertise in data architecture and data wrangling, and you are a master of Python, SQL, and BigQuery."],
    ["Highly recommended: Master's or PhD in Computer Science, Statistics, or related STEM fields."],
    ["We hire in AL, AK, AR, AZ, CA, MI, MN, MO, MS, MT, NC, ND."],
    ["Due to said guidelines put in place, we are unable to hire in AK, DE, HI, IA, LA, MS, MT, OK, and SC."],
  ])("does not read %s as requiring a master's", (text) => {
    expect(degreeOf(text)).toBeUndefined()
  })

  test("reads a 'Minimum education' line even when it comes after a preferred heading", () => {
    const text = "PhD in biochemistry or a related field\nPreferred qualifications\n5+ years of antibody work\nMinimum education: Bachelor’s degree or an equivalent combination of education, training, and/or experience"

    expect(degreeOf(text)).toBeUndefined()
  })

  test("does not require a PhD when the posting's minimum is a lower degree or equivalent experience", () => {
    const text = "PhD in chemistry, computational chemistry, or a related field\nMinimum education: Bachelor’s degree or an equivalent combination of education, training, and/or experience"

    expect(degreeOf(text)).toBeUndefined()
  })

  test("reads 'The ideal candidate will have:' as the list of requirements, not of wishes", () => {
    expect(degreeOf("The ideal candidate will have:\nA bachelor’s degree or higher in computer science or a related discipline")).toBe("bachelor")
  })

  test("leaves out a degree that experience can stand in for", () => {
    expect(degreeOf("PhD in Computer Science or equivalent practical experience")).toBeUndefined()
  })

  test("reads a degree named in the title, as in 'Data Scientist Intern - PhD'", () => {
    expect(degreeOf("Python and SQL.", "(SUMMER) Data Scientist Intern - PhD")).toBe("phd")
    expect(degreeOf("Python and SQL.", "2027 Summer Internship - MS/PhD Data Scientist")).toBe("master")
  })

  test.each([["Proficiency with MS Office, especially Excel"], ["Experience with MS SQL Server."], ["We hire recent graduates from all backgrounds."], ["No degree is named here."]])(
    "finds no degree in %s",
    (text) => {
      expect(degreeOf(text)).toBeUndefined()
    },
  )
})

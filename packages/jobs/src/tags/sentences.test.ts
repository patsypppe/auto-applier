// Tests that splitSentences cuts job text into sentences without breaking at "U.S." and similar abbreviations.
import { describe, expect, test } from "vitest"
import { splitSentences } from "./sentences"

describe("splitSentences", () => {
  test("splits at the end of each sentence", () => {
    expect(splitSentences("We build tools. You will help! Ready?")).toEqual(["We build tools.", "You will help!", "Ready?"])
  })

  test("does not break after U.S., U.S.A., Inc. or e.g.", () => {
    const text = "Applicants must be U.S. persons. Acme Inc. works with the U.S.A. Army, e.g. on radios."

    expect(splitSentences(text)).toEqual(["Applicants must be U.S. persons.", "Acme Inc. works with the U.S.A. Army, e.g. on radios."])
  })

  test("does not break inside a legal citation like 8 U.S.C. 1324b", () => {
    expect(splitSentences("Protected individual as defined by 8 U.S.C. 1324b(a)(3). Next.")).toEqual([
      "Protected individual as defined by 8 U.S.C. 1324b(a)(3).",
      "Next.",
    ])
  })

  test("treats each line as its own sentence, since bullet lists often have no periods", () => {
    expect(splitSentences("Requirements\nActive TS/SCI clearance\nU.S. citizenship required")).toEqual([
      "Requirements",
      "Active TS/SCI clearance",
      "U.S. citizenship required",
    ])
  })

  test("drops empty lines and extra spaces", () => {
    expect(splitSentences("  One.  \n\n \n  Two.  ")).toEqual(["One.", "Two."])
  })
})

// Tests what each work-authorization tag means for each kind of applicant, and how a job's tags add up.
import { describe, expect, test } from "vitest"
import type { WorkAuth } from "../types"
import { canUseStemOpt, effectOf, jobEffect } from "./effects"

const citizen: WorkAuth = { status: "citizen", needsSponsorshipLater: false, stemDegree: false, clearance: "can-obtain" }
const resident: WorkAuth = { status: "permanent-resident", needsSponsorshipLater: false, stemDegree: false, clearance: "none" }
const optStudent: WorkAuth = { status: "f1-opt", needsSponsorshipLater: true, stemDegree: true, clearance: "none" }
const cptIntern: WorkAuth = { status: "f1-cpt", needsSponsorshipLater: false, stemDegree: false, clearance: "none" }
const h1bHolder: WorkAuth = { status: "h1b", needsSponsorshipLater: true, stemDegree: false, clearance: "none" }

describe("effectOf", () => {
  test("lets only citizens through a citizens-only rule", () => {
    expect([citizen, resident, optStudent].map((who) => effectOf("citizen-only", who))).toEqual(["ok", "blocked", "blocked"])
  })

  test("lets citizens and permanent residents through a U.S. person rule", () => {
    expect([citizen, resident, optStudent, h1bHolder].map((who) => effectOf("us-person", who))).toEqual(["ok", "ok", "blocked", "blocked"])
  })

  test("treats no sponsorship as likely blocked for an OPT student who will need H-1B later", () => {
    expect(effectOf("no-sponsorship", optStudent)).toBe("likely-blocked")
  })

  test("treats no sponsorship as fine for a CPT intern who will not need sponsorship", () => {
    expect(effectOf("no-sponsorship", cptIntern)).toBe("ok")
  })

  test("treats no sponsorship as blocked for someone who needs an H-1B transfer now", () => {
    expect(effectOf("no-sponsorship", h1bHolder)).toBe("blocked")
  })

  test("treats no sponsorship now or later as blocked for an OPT student who needs it later", () => {
    expect(effectOf("no-future-sponsorship", optStudent)).toBe("blocked")
  })

  test("lets only citizens and permanent residents through a rule against temporary visa holders", () => {
    expect([citizen, resident, optStudent, cptIntern, h1bHolder].map((who) => effectOf("no-visa-holders", who))).toEqual([
      "ok",
      "ok",
      "blocked",
      "blocked",
      "blocked",
    ])
  })

  test("treats a clearance as fine for a citizen who can get one and likely blocked for one who cannot", () => {
    expect(effectOf("clearance", citizen)).toBe("ok")
    expect(effectOf("clearance", { ...citizen, clearance: "none" })).toBe("likely-blocked")
  })

  test("treats a clearance as blocked for students and likely blocked for permanent residents", () => {
    expect([optStudent, resident].map((who) => effectOf("clearance", who))).toEqual(["blocked", "likely-blocked"])
  })

  test("counts an offer of sponsorship as a plus only for people who need it", () => {
    expect([citizen, optStudent].map((who) => effectOf("sponsors", who))).toEqual(["ok", "positive"])
  })

  test("counts E-Verify as a plus for a student with a STEM degree, who will need it for STEM OPT", () => {
    expect(effectOf("e-verify", optStudent)).toBe("positive")
    expect(effectOf("e-verify", { ...optStudent, stemDegree: false })).toBe("ok")
    expect(effectOf("e-verify", citizen)).toBe("ok")
  })

  test("counts E-Verify in only some places as fine, not a plus, since the job's own place may not be one of them", () => {
    expect(effectOf("e-verify-some-places", optStudent)).toBe("ok")
    expect(effectOf("e-verify-some-places", { ...cptIntern, status: "f1-stem-opt" })).toBe("ok")
  })

  test("never blocks anyone for an unclear statement or for saying nothing", () => {
    for (const who of [citizen, resident, optStudent, cptIntern, h1bHolder]) {
      expect([effectOf("unclear", who), effectOf("not-stated", who)]).toEqual(["ok", "ok"])
    }
  })
})

describe("canUseStemOpt", () => {
  test("is true on STEM OPT, or for an F-1 student with a STEM degree, and false for everyone else", () => {
    expect(canUseStemOpt({ ...cptIntern, status: "f1-stem-opt" })).toBe(true)
    expect(canUseStemOpt(optStudent)).toBe(true)
    expect(canUseStemOpt({ ...optStudent, stemDegree: false })).toBe(false)
    expect(canUseStemOpt({ ...citizen, stemDegree: true })).toBe(false)
    expect(canUseStemOpt(h1bHolder)).toBe(false)
  })
})

describe("jobEffect", () => {
  test("takes the worst effect of a job's tags", () => {
    expect(jobEffect(["e-verify", "no-sponsorship", "us-person"], optStudent)).toBe("blocked")
  })

  test("is a plus only when nothing is worse than ok", () => {
    expect(jobEffect(["e-verify", "not-stated"], optStudent)).toBe("positive")
    expect(jobEffect(["e-verify", "no-sponsorship"], optStudent)).toBe("likely-blocked")
  })
})

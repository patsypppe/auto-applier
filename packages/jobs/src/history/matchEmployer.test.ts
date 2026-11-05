// Tests that matchEmployer finds a company's H-1B filings by exact name, by alias, or by a name with a generic ending, and
// says so when it cannot tell.
import { describe, expect, test } from "vitest"
import type { H1bHistory } from "./readH1bCsv"
import { matchEmployer } from "./matchEmployer"

const employer = (name: string, approvals: number) => ({ name, approvals, newEmploymentApprovals: Math.floor(approvals / 2), denials: 0 })

const HISTORY: H1bHistory = {
  fiscalYear: 2026,
  employers: {
    stripe: employer("STRIPE LLC", 340),
    "openai opco": employer("OPENAI OPCO LLC", 424),
    "notion labs": employer("NOTION LABS INC", 23),
    "space exploration technologies": employer("SPACE EXPLORATION TECHNOLOGIES CORP", 31),
    "focal studio corporation dba zenyt": employer("FOCAL STUDIO CORPORATION DBA ZENYT", 2),
    "axon us": employer("AXON US INC", 3),
    "axon networks": employer("AXON NETWORKS INC", 3),
  },
}

describe("matchEmployer", () => {
  test("matches a company whose name is the same once endings and punctuation are taken off", () => {
    expect(matchEmployer("Stripe", HISTORY, {})).toEqual({ status: "matched", how: "exact", employer: "STRIPE LLC", approvals: 340, newEmploymentApprovals: 170, fiscalYear: 2026 })
  })

  test("matches a filing name that adds only a generic word, like Labs or Opco", () => {
    expect(matchEmployer("Notion", HISTORY, {})).toMatchObject({ status: "matched", how: "generic-ending", employer: "NOTION LABS INC" })
    expect(matchEmployer("OpenAI", HISTORY, {})).toMatchObject({ status: "matched", employer: "OPENAI OPCO LLC" })
  })

  test("does not match a filing name that adds words that make it another company", () => {
    expect(matchEmployer("Focal", HISTORY, {})).toEqual({ status: "none", fiscalYear: 2026 })
  })

  test("says it cannot tell when several filing names fit", () => {
    expect(matchEmployer("Axon", HISTORY, {})).toEqual({ status: "ambiguous", candidates: ["AXON NETWORKS INC", "AXON US INC"], fiscalYear: 2026 })
  })

  test("uses a hand-written alias first", () => {
    expect(matchEmployer("SpaceX", HISTORY, { SpaceX: "SPACE EXPLORATION TECHNOLOGIES CORP" })).toMatchObject({ status: "matched", how: "alias", approvals: 31 })
  })

  test("says there is nothing when no filing name fits", () => {
    expect(matchEmployer("Anduril Industries", HISTORY, {})).toEqual({ status: "none", fiscalYear: 2026 })
  })
})

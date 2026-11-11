// Tests that renderCard builds a job card from text only, shows the evidence for each tag, and reports status changes.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"
import { filterCards } from "./filterCards"
import { renderCard } from "./renderCard"

const CARD: Card = {
  key: "greenhouse:acme:1",
  company: "Acme",
  title: "Data Analyst",
  url: "https://boards.example/1",
  locations: ["Austin, TX"],
  country: "US",
  postedAt: "2026-11-03T00:00:00Z",
  firstSeenAt: "2026-11-04T00:00:00Z",
  score: 77,
  effect: "likely-blocked",
  reasons: { matchedSkills: ["Python", "SQL"], missingSkills: ["Looker"], titleMatches: true, yearsRequired: 2 },
  tags: [{ tag: "no-sponsorship", evidence: "We are unable to sponsor visas.", context: "About us. We are unable to sponsor visas." }],
}

describe("renderCard", () => {
  test("shows the title as a link, the company, places, score and skills", () => {
    const card = renderCard(CARD, undefined, vi.fn())

    const link = card.querySelector("a")!
    expect(link.textContent).toBe("Data Analyst")
    expect(link.getAttribute("href")).toBe("https://boards.example/1")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    expect(card.textContent).toContain("Acme")
    expect(card.textContent).toContain("Austin, TX")
    expect(card.textContent).toContain("77")
    expect(card.textContent).toContain("You have: Python, SQL")
    expect(card.textContent).toContain("Missing: Looker")
    expect(card.textContent).toContain("Asks for 2+ years")
  })

  test.each([
    [{ min: 95000, max: 115000, currency: "USD", per: "year" }, "Pay: $95,000 to $115,000 a year"],
    [{ min: 22, max: 25.5, currency: "USD", per: "hour" }, "Pay: $22 to $25.50 an hour"],
    [{ min: 166600, max: 182000, currency: "CAD", per: "year" }, "Pay: CAD 166,600 to 182,000 a year"],
  ] as const)("shows the pay %o as %s", (pay, line) => {
    const card = renderCard({ ...CARD, pay: { ...pay, from: "text" } }, undefined, vi.fn())

    expect(card.textContent).toContain(line)
  })

  test("says a STEM OPT student can work at an E-Verify employer, when nothing else blocks the job", () => {
    const eVerify: Card = { ...CARD, effect: "positive", tags: [{ tag: "e-verify", evidence: "We participate in E-Verify.", context: "We participate in E-Verify." }] }
    const badge = "E-Verify employer: STEM OPT can work here"

    expect(renderCard(eVerify, undefined, vi.fn(), { stemOpt: true }).querySelector(".stem-opt")?.textContent).toBe(badge)
    expect(renderCard(eVerify, undefined, vi.fn()).textContent).not.toContain(badge)
    expect(renderCard({ ...eVerify, effect: "likely-blocked" }, undefined, vi.fn(), { stemOpt: true }).textContent).not.toContain(badge)
    expect(renderCard({ ...CARD, effect: "positive" }, undefined, vi.fn(), { stemOpt: true }).textContent).not.toContain(badge)
    const somePlaces: Card = { ...eVerify, tags: [{ tag: "e-verify-some-places", evidence: "In certain locations.", context: "In certain locations." }] }
    expect(renderCard(somePlaces, undefined, vi.fn(), { stemOpt: true }).textContent).not.toContain(badge)
  })

  test("keeps under E-Verify only exactly the cards that show the badge", () => {
    const tag = (name: "e-verify" | "e-verify-some-places") => ({ tag: name, evidence: "E-Verify.", context: "E-Verify." })
    const cards: Card[] = [
      { ...CARD, key: "plus", effect: "positive", tags: [tag("e-verify")] },
      { ...CARD, key: "blocked", effect: "blocked", tags: [tag("e-verify")] },
      { ...CARD, key: "likely", effect: "likely-blocked", tags: [tag("e-verify")] },
      { ...CARD, key: "some-places", effect: "positive", tags: [tag("e-verify-some-places")] },
      { ...CARD, key: "none", effect: "positive", tags: [] },
    ]
    const filters = { search: "", effect: "any", status: "any", sort: "score", newOnly: false, eVerifyOnly: true } as const

    const kept = filterCards(cards, filters, []).map((card) => card.key)
    const withBadge = cards.filter((card) => renderCard(card, undefined, vi.fn(), { stemOpt: true }).querySelector(".stem-opt")).map((card) => card.key)

    expect(kept).toEqual(["plus"])
    expect(kept).toEqual(withBadge)
  })

  test("names the status menu after the job and reads the score out as a match score", () => {
    const card = renderCard(CARD, undefined, vi.fn())

    expect(card.querySelector(".status select")!.getAttribute("aria-label")).toBe("Status of Data Analyst at Acme")
    expect(card.querySelector(".score")!.textContent).toBe("Match score 77")
    expect(card.querySelector(".score .visually-hidden")!.textContent).toBe("Match score ")
  })

  test("says why a hidden card was hidden, when given a reason", () => {
    const why = "Hidden because it was posted more than 30 days ago. Set by the Posted chip."

    expect(renderCard(CARD, undefined, vi.fn(), { why }).querySelector(".why")?.textContent).toBe(why)
    expect(renderCard(CARD, undefined, vi.fn()).querySelector(".why")).toBeNull()
  })

  test("marks a job first seen since the last visit as new", () => {
    expect(renderCard(CARD, undefined, vi.fn(), { isNew: true }).textContent).toContain("New")
    expect(renderCard(CARD, undefined, vi.fn()).querySelector(".new")).toBeNull()
  })

  test("says which degree the posting requires", () => {
    const card = renderCard({ ...CARD, reasons: { ...CARD.reasons, degreeRequired: "phd" } }, undefined, vi.fn())

    expect(card.textContent).toContain("Needs a PhD")
  })

  test("shows the job type and workplace when the board gives them, and no pay line when there is none", () => {
    const card = renderCard({ ...CARD, jobType: "intern", workplace: "hybrid" }, undefined, vi.fn())

    expect(card.textContent).toContain("Intern, hybrid")
    expect(card.textContent).not.toContain("Pay:")
  })

  test("puts text from the posting in as text, never as HTML", () => {
    const card = renderCard({ ...CARD, title: '<img src=x onerror="alert(1)">', company: "<b>Acme</b>" }, undefined, vi.fn())

    expect(card.querySelector("img")).toBeNull()
    expect(card.querySelector("b")).toBeNull()
    expect(card.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  test("links only to web addresses, so a javascript: link from a posting does nothing", () => {
    const card = renderCard({ ...CARD, url: "javascript:alert(1)" }, undefined, vi.fn())

    expect(card.querySelector("a")!.getAttribute("href")).toBe("#")
  })

  test("shows each tag with its evidence sentence and the sentences around it", () => {
    const card = renderCard(CARD, undefined, vi.fn())

    const tag = card.querySelector("details")!
    expect(tag.querySelector("summary")!.textContent).toBe("no sponsorship")
    expect(tag.textContent).toContain("About us. We are unable to sponsor visas.")
    expect(card.textContent).toContain("Likely blocked for you")
  })

  test("shows the current status and the date it was set", () => {
    const applied: AppliedEntry = {
      key: CARD.key,
      company: "Acme",
      title: "Data Analyst",
      url: CARD.url,
      status: "applied",
      changes: [{ status: "applied", date: "2026-11-02T15:00:00.000Z" }],
    }

    const card = renderCard(CARD, applied, vi.fn())

    expect(card.querySelector("select")!.value).toBe("applied")
    expect(card.textContent).toContain("since 2026-11-02")
  })

  test("shows the status date in the user's own time zone, not UTC", () => {
    const lateEvening = "2026-11-05T02:00:00.000Z"
    const applied: AppliedEntry = { key: CARD.key, company: "Acme", title: "Data Analyst", url: CARD.url, status: "applied", changes: [{ status: "applied", date: lateEvening }] }

    const card = renderCard(CARD, applied, vi.fn())

    expect(card.textContent).toContain(`since ${new Date(lateEvening).toLocaleDateString("en-CA")}`)
  })

  test("shows the employer's H-1B approvals next to the tags", () => {
    const history = { status: "matched", how: "exact", employer: "ACME INC", approvals: 340, newEmploymentApprovals: 152, fiscalYear: 2026 } as const

    expect(renderCard({ ...CARD, history }, undefined, vi.fn()).textContent).toContain(
      "USCIS approved 340 H-1B petitions for ACME INC in FY2026, 152 of them for new employment.",
    )
  })

  test("asks the user to check a match made by a similar name", () => {
    const history = { status: "matched", how: "generic-ending", employer: "NOTION LABS INC", approvals: 23, newEmploymentApprovals: 3, fiscalYear: 2026 } as const

    expect(renderCard({ ...CARD, history }, undefined, vi.fn()).textContent).toContain(
      "USCIS approved 23 H-1B petitions for NOTION LABS INC in FY2026, 3 of them for new employment. Matched by a similar name, so check it is the same company.",
    )
  })

  test("says plainly when no H-1B filings were found or the name was unclear", () => {
    const none = renderCard({ ...CARD, history: { status: "none", fiscalYear: 2026 } }, undefined, vi.fn())
    const ambiguous = renderCard({ ...CARD, history: { status: "ambiguous", candidates: ["AXON NETWORKS INC", "AXON US INC"], fiscalYear: 2026 } }, undefined, vi.fn())

    expect(none.textContent).toContain("No FY2026 H-1B approvals found under this name. The company may file under another legal name.")
    expect(ambiguous.textContent).toContain("The FY2026 H-1B data has similar names (AXON NETWORKS INC, AXON US INC) but none that is surely this company.")
  })

  test("reports a new status when the user picks one", () => {
    const onStatus = vi.fn()
    const card = renderCard(CARD, undefined, onStatus)

    const select = card.querySelector("select")!
    select.value = "saved"
    select.dispatchEvent(new Event("change"))

    expect(onStatus).toHaveBeenCalledWith("saved")
  })

  test("lists the other links of a job joined from several copies", () => {
    const copies = [
      { id: "1", url: "https://boards.example/1", locations: ["Austin, TX"] },
      { id: "9", url: "https://boards.example/9", locations: ["Dallas, TX"] },
    ]

    const card = renderCard({ ...CARD, copies }, undefined, vi.fn())

    expect([...card.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
      "https://boards.example/1",
      "https://boards.example/9",
    ])
  })
})

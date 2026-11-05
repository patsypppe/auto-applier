// Tests that renderCard builds a job card from text only, shows the evidence for each tag, and reports status changes.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"
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

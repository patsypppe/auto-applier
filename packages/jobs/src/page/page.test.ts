// Tests that the feed page keeps working when the server answers late, out of order, with an error, or not at all.
// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { AppliedEntry } from "../feed/applied"
import type { Card } from "../feed/card"
import { parseSettings } from "../settings"

type Reply = { status: number; body: unknown } | "no answer"
type Handler = (url: URL, body: unknown) => Reply | Promise<Reply>


// Builds a card with the given key and title.
function card(key: string, title: string): Card {
  return {
    key,
    company: "Acme",
    title,
    url: `https://boards.example/${key}`,
    locations: ["Austin, TX"],
    country: "US",
    firstSeenAt: "2026-11-04T00:00:00Z",
    score: 70,
    effect: "ok",
    reasons: { matchedSkills: ["Python"], missingSkills: [], titleMatches: true },
    tags: [],
  }
}

// Builds a feed answer with the given shown cards and, optionally, hidden counts, hidden cards and history.
function feed(shown: Card[], more: { hidden?: { reason: string; count: number }[]; extra?: Card[]; applied?: AppliedEntry[]; total?: number } = {}) {
  return { needsSettings: false, total: more.total ?? shown.length, shown, hidden: more.hidden ?? [], extra: more.extra ?? [], applied: more.applied ?? [], filters: SETTINGS.filters, stemOpt: false }
}

const SETTINGS = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } })

let routes: Record<string, Handler>

// Answers the page's requests from the routes the test set, as the local server would.
async function fakeFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, "http://127.0.0.1:4317")
  const handler = routes[`${init?.method ?? "GET"} ${url.pathname}`]
  const reply = handler ? await handler(url, init?.body ? JSON.parse(String(init.body)) : undefined) : { status: 404, body: { error: "Not found" } }
  if (reply === "no answer") throw new TypeError("Failed to fetch")
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } })
}

// Waits until the page has handled every answer that is ready.
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

// Returns a reply the test sends later, and the function that sends it.
function later(): { reply: Promise<Reply>; send: (reply: Reply) => void } {
  let send: (reply: Reply) => void = () => undefined
  const reply = new Promise<Reply>((resolve) => (send = resolve))
  return { reply, send }
}

// Puts the page's own HTML in the document and runs the page script against the fake server.
async function openPage(): Promise<void> {
  const html = new DOMParser().parseFromString(readFileSync(join(import.meta.dirname, "index.html"), "utf8"), "text/html")
  html.querySelector("script")?.remove()
  document.head.replaceChildren(...Array.from(html.head.childNodes, (node) => document.importNode(node, true)))
  document.body.replaceChildren(...Array.from(html.body.childNodes, (node) => document.importNode(node, true)))
  vi.resetModules()
  await import("./page")
  await settle()
}

// Returns the titles of the cards in a container.
function titles(id: string): string[] {
  return Array.from(document.querySelectorAll(`#${id} .card h2`), (heading) => heading.textContent ?? "")
}

// Returns the text of the page's problem line, or "" when it shows none.
function problem(): string {
  const line = document.getElementById("problem")!
  return line.hidden ? "" : (line.textContent ?? "")
}

// Clicks the hidden-reason button whose text starts with the reason.
function showHidden(reason: string): void {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("#summary button")).find((item) => item.textContent?.startsWith(reason))
  button!.click()
}

// Picks a status in the first card's status menu.
function pickStatus(value: string): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("#cards .status select")!
  select.value = value
  select.dispatchEvent(new Event("change"))
  return select
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal("fetch", fakeFetch)
  vi.stubGlobal("confirm", () => true)
  routes = { "GET /api/settings": () => ({ status: 200, body: { settings: SETTINGS } }) }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the feed page", () => {
  test("draws the cards and the summary from the server's feed", async () => {
    routes["GET /api/feed"] = () => ({ status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 4 }], total: 5 }) })

    await openPage()

    expect(titles("cards")).toEqual(["Data Analyst"])
    expect(document.getElementById("summary")!.textContent).toContain("Showing 1 of 5 jobs")
    expect(problem()).toBe("")
  })

  test("drops an older answer that arrives after a newer one", async () => {
    const answers: ReturnType<typeof later>[] = []
    let loads = 0
    routes["GET /api/feed"] = () => {
      if (++loads === 1) return { status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], total: 2 }) }
      const next = later()
      answers.push(next)
      return next.reply
    }
    await openPage()

    showHidden("old")
    showHidden("old")
    answers[1]!.send({ status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], extra: [card("3", "Newer Answer")], total: 2 }) })
    await settle()
    answers[0]!.send({ status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], extra: [card("2", "Older Answer")], total: 2 }) })
    await settle()

    expect(titles("extra")).toEqual(["Newer Answer"])
  })

  test("keeps a status saved while a load was on its way", async () => {
    const slow = later()
    let loads = 0
    routes["GET /api/feed"] = () => (++loads === 1 ? { status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], total: 2 }) } : slow.reply)
    const entry: AppliedEntry = { key: "1", company: "Acme", title: "Data Analyst", url: "https://boards.example/1", status: "applied", changes: [{ status: "applied", date: "2026-11-10T12:00:00Z" }] }
    routes["POST /api/applied"] = () => ({ status: 200, body: { applied: [entry] } })
    await openPage()

    showHidden("old")
    pickStatus("applied")
    await settle()
    slow.send({ status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], total: 2 }) })
    await settle()

    expect(document.querySelector<HTMLSelectElement>("#cards .status select")!.value).toBe("applied")
    expect(document.getElementById("history")!.textContent).toContain("Data Analyst at Acme: applied")
  })

  test("keeps the feed on screen and says what went wrong when a load fails, and the controls keep working", async () => {
    let loads = 0
    routes["GET /api/feed"] = () => (++loads === 1 ? { status: 200, body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], total: 2 }) } : { status: 500, body: { error: "Internal error" } })
    await openPage()

    showHidden("old")
    await settle()
    const search = document.getElementById("search") as HTMLInputElement
    search.value = "analyst"
    search.dispatchEvent(new Event("input"))

    expect(titles("cards")).toEqual(["Data Analyst"])
    expect(problem()).toContain("Internal error")
  })

  test("says the server did not answer instead of loading forever", async () => {
    routes["GET /api/feed"] = () => "no answer"

    await openPage()

    expect(problem()).toContain("did not answer")
    expect(document.getElementById("summary")!.textContent).not.toContain("Loading")
  })

  test("puts the status menu back and says so when a status save fails", async () => {
    routes["GET /api/feed"] = () => ({ status: 200, body: feed([card("1", "Data Analyst")]) })
    routes["POST /api/applied"] = () => "no answer"
    await openPage()

    pickStatus("applied")
    await settle()

    expect(document.querySelector<HTMLSelectElement>("#cards .status select")!.value).toBe("none")
    expect(problem()).toContain("status")
  })

  test("enables Save again and shows the mistake when a settings save fails", async () => {
    routes["GET /api/feed"] = () => ({ status: 200, body: feed([card("1", "Data Analyst")]) })
    routes["POST /api/settings"] = () => "no answer"
    await openPage()

    document.querySelector("#settings form")!.dispatchEvent(new Event("submit", { cancelable: true }))
    await settle()

    expect(document.querySelector<HTMLButtonElement>("#settings button[type='submit']")!.disabled).toBe(false)
    expect(document.querySelector("#settings .errors")!.textContent).toContain("did not answer")
  })

  test("falls back to the defaults when what the browser stored is broken or out of date", async () => {
    localStorage.setItem("job-feed-chips", "null")
    localStorage.setItem("job-feed-filters", JSON.stringify({ effect: "gone", sort: 5 }))
    routes["GET /api/feed"] = () => ({ status: 200, body: feed([card("1", "Data Analyst")]) })

    await openPage()

    expect((document.getElementById("effect") as HTMLSelectElement).value).toBe("any")
    expect((document.getElementById("sort") as HTMLSelectElement).value).toBe("score")
    expect(titles("cards")).toEqual(["Data Analyst"])
  })

  test.each([
    ["no jobs were collected", feed([], { total: 0 }), "No jobs have been collected yet"],
    ["every job is hidden", feed([], { hidden: [{ reason: "old", count: 3 }], total: 3 }), "All 3 jobs are hidden"],
  ])("says why the list is empty when %s", async (_, body, message) => {
    routes["GET /api/feed"] = () => ({ status: 200, body })

    await openPage()

    expect(document.getElementById("cards")!.textContent).toContain(message)
  })

  test("lets a settings save after a chip change take effect, by clearing the chips the save covers", async () => {
    const asked: URLSearchParams[] = []
    routes["GET /api/feed"] = (url) => {
      asked.push(url.searchParams)
      return { status: 200, body: feed([card("1", "Data Analyst")]) }
    }
    routes["POST /api/settings"] = () => ({ status: 200, body: { settings: SETTINGS } })
    await openPage()

    const years = document.querySelector<HTMLSelectElement>("#chips select[name='maxYears']")!
    years.value = "5"
    years.dispatchEvent(new Event("change"))
    await settle()
    expect(asked.at(-1)!.get("maxYears")).toBe("5")

    document.querySelector("#settings form")!.dispatchEvent(new Event("submit", { cancelable: true }))
    await settle()

    expect(asked.at(-1)!.has("maxYears")).toBe(false)
    expect(localStorage.getItem("job-feed-chips")).not.toContain("maxYears")
  })

  test("says on each hidden card which setting or chip hid it", async () => {
    routes["GET /api/feed"] = (url) => ({
      status: 200,
      body: feed([card("1", "Data Analyst")], { hidden: [{ reason: "old", count: 1 }], extra: url.searchParams.has("show") ? [card("2", "Old Job")] : [], total: 2 }),
    })
    await openPage()

    showHidden("old")
    await settle()

    expect(document.querySelector("#extra .why")?.textContent).toBe("Hidden because it was posted more than 90 days ago. Set by Posted within in the settings panel.")
  })

  test("folds the search, menus and chips behind one Filters button that opens and closes them", async () => {
    routes["GET /api/feed"] = () => ({ status: 200, body: feed([card("1", "Data Analyst")]) })
    await openPage()

    const toggle = document.getElementById("filters-toggle") as HTMLButtonElement
    const filters = document.getElementById(toggle.getAttribute("aria-controls")!)!
    for (const id of ["search", "effect", "status", "sort", "chips"]) expect(filters.contains(document.getElementById(id))).toBe(true)
    expect(filters.contains(document.getElementById("cards"))).toBe(false)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")

    toggle.click()
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(filters.classList.contains("open")).toBe(true)

    toggle.click()
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(filters.classList.contains("open")).toBe(false)
  })

  test("says why the list is empty when the search and menus leave nothing", async () => {
    routes["GET /api/feed"] = () => ({ status: 200, body: feed([card("1", "Data Analyst")]) })
    await openPage()

    const search = document.getElementById("search") as HTMLInputElement
    search.value = "zzz"
    search.dispatchEvent(new Event("input"))

    expect(document.getElementById("cards")!.textContent).toContain("No job matches the search, menus and chips")
  })
})

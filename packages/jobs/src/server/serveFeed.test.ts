// Tests the local feed server: the page, the feed with hidden counts, hidden jobs on request, saving statuses and
// settings, and refusing requests that come from other sites or would stop it.
import type { Profile } from "@auto-applier/core"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { request as httpRequest } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { prepareJobs } from "../feed/getJobs"
import { parseSettings } from "../settings"
import type { JobRecord } from "../types"
import { serveFeed } from "./serveFeed"

const SETTINGS = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } })
const PROFILE: Profile = {
  personal: { firstName: "Sam", lastName: "Rivera", email: "sam@example.com", phone: "5550100", links: {} },
  experience: [],
  education: [],
  skills: ["Python"],
  answers: { workAuthorization: "F-1 OPT", needsSponsorship: true, isAuthorizedToWork: true },
}

// Builds a recent US job with the given details.
function job(id: string, details: Partial<JobRecord> = {}): JobRecord {
  return {
    key: `greenhouse:acme:${id}`,
    ats: "greenhouse",
    slug: "acme",
    company: "Acme",
    id,
    title: "Data Analyst",
    url: `https://boards.example/${id}`,
    locations: ["Austin, TX"],
    country: "US",
    postedAt: new Date().toISOString(),
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    description: "Python and SQL.",
    ...details,
  }
}

const JOBS = [job("1"), job("2", { description: "U.S. citizenship required." }), job("3", { title: "Sales Lead" })]

let dataDir = ""
let pageFiles = ""
let server: { url: string; token: string; close: () => Promise<void> }

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "serve-data-"))
  const pageDir = await mkdtemp(join(tmpdir(), "serve-page-"))
  await writeFile(join(pageDir, "index.html"), '<!doctype html><meta name="feed-token" content=""><title>Job feed</title>')
  await writeFile(join(pageDir, "page.js"), "console.info('page')")
  pageFiles = pageDir
  server = await serveFeed({ prepared: prepareJobs(PROFILE, JOBS), settings: SETTINGS, dataDir, pageDir, port: 0 })
})

afterEach(async () => {
  await server.close()
})

describe("serveFeed: what it serves", () => {
  test("listens only on this computer", () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  test("serves the page and its script", async () => {
    const page = await fetch(server.url)
    const script = await fetch(`${server.url}/page.js`)

    expect(page.headers.get("content-type")).toContain("text/html")
    expect(await page.text()).toContain("Job feed")
    expect(script.headers.get("content-type")).toContain("javascript")
  })

  test("answers 404 for anything else", async () => {
    expect((await fetch(`${server.url}/../secrets.txt`)).status).toBe(404)
  })
})

describe("serveFeed: the feed", () => {
  test("sends the shown jobs and how many were hidden for each reason", async () => {
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(feed.total).toBe(3)
    expect(feed.shown.map((card: { key: string }) => card.key)).toEqual(["greenhouse:acme:1"])
    expect(feed.hidden).toEqual([
      { reason: "blocked", count: 1 },
      { reason: "role", count: 1 },
    ])
    expect(feed.extra).toEqual([])
  })

  test("sends the hidden jobs for one reason when asked", async () => {
    const feed = await (await fetch(`${server.url}/api/feed?show=blocked`)).json()

    expect(feed.extra.map((card: { key: string; tags: { tag: string; evidence: string }[] }) => [card.key, card.tags[0]])).toEqual([
      ["greenhouse:acme:2", { tag: "citizen-only", evidence: "U.S. citizenship required.", context: "U.S. citizenship required." }],
    ])
  })

  test("applies the page's filter chips for that request only, and sends back the filters it used", async () => {
    const narrowed = await (await fetch(`${server.url}/api/feed?within=7&workplace=remote`)).json()
    const plain = await (await fetch(`${server.url}/api/feed`)).json()

    expect(narrowed.filters).toMatchObject({ postedWithinDays: 7, workplaces: ["remote"] })
    expect(plain.filters).toMatchObject({ postedWithinDays: 90, workplaces: [] })
  })

  test("says whether the STEM OPT E-Verify rule applies to the user", async () => {
    expect((await (await fetch(`${server.url}/api/feed`)).json()).stemOpt).toBe(false)
  })

  test("refuses a filter chip it cannot use, saying what it takes", async () => {
    const answer = await fetch(`${server.url}/api/feed?workplace=office`)

    expect(answer.status).toBe(400)
    expect(await answer.json()).toEqual({ error: "workplace may only use remote, hybrid, onsite." })
  })

  test("leaves the long description out of each card", async () => {
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(feed.shown[0].description).toBeUndefined()
  })
})

describe("serveFeed: statuses", () => {
  // Sends a status change and returns the answer.
  function post(body: unknown) {
    return fetch(`${server.url}/api/applied`, { method: "POST", headers: { "Content-Type": "application/json", "X-Feed-Token": server.token }, body: JSON.stringify(body) })
  }

  test("saves a status to data/applied.json and sends it back with the feed", async () => {
    const answer = await post({ key: "greenhouse:acme:1", status: "applied", note: "Sent on Monday" })
    const saved = JSON.parse(await readFile(join(dataDir, "applied.json"), "utf8"))
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(answer.status).toBe(200)
    expect(saved[0]).toMatchObject({ key: "greenhouse:acme:1", title: "Data Analyst", status: "applied", note: "Sent on Monday" })
    expect(feed.applied[0].status).toBe("applied")
  })

  test("refuses a status it does not know, saying which ones it does", async () => {
    const answer = await post({ key: "greenhouse:acme:1", status: "ghosted" })

    expect(answer.status).toBe(400)
    expect((await answer.json()).error).toBe("status must be one of saved, applied, interviewing, offer, rejected, none.")
  })

  test("refuses a job it has never seen", async () => {
    const answer = await post({ key: "greenhouse:nobody:9", status: "applied" })

    expect(answer.status).toBe(404)
    expect((await answer.json()).error).toBe("No job with key greenhouse:nobody:9.")
  })

  test("still updates a job that is in the history but no longer listed", async () => {
    await writeFile(
      join(dataDir, "applied.json"),
      JSON.stringify([{ key: "greenhouse:gone:5", company: "Gone", title: "Analyst", url: "u", status: "applied", changes: [] }]),
    )

    expect((await post({ key: "greenhouse:gone:5", status: "rejected" })).status).toBe(200)
  })
})

describe("serveFeed: settings", () => {
  // Sends settings to the server and returns the answer.
  function postSettings(url: string, body: unknown, token = server.token) {
    return fetch(`${url}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json", "X-Feed-Token": token }, body: JSON.stringify(body) })
  }

  test("sends the settings in use", async () => {
    expect(await (await fetch(`${server.url}/api/settings`)).json()).toEqual({ settings: SETTINGS })
  })

  test("saves new settings to data/settings.json and ranks the feed again with them", async () => {
    const answer = await postSettings(server.url, { workAuth: { status: "citizen" }, filters: { roles: ["sales lead"], levels: [] } })
    const feed = await (await fetch(`${server.url}/api/feed`)).json()

    expect(answer.status).toBe(200)
    expect((await answer.json()).settings.filters.roles).toEqual(["sales lead"])
    expect(JSON.parse(await readFile(join(dataDir, "settings.json"), "utf8")).workAuth.status).toBe("citizen")
    expect(feed.shown.map((card: { key: string }) => card.key)).toEqual(["greenhouse:acme:3"])
  })

  test("refuses settings with mistakes, lists every one, and changes nothing", async () => {
    const answer = await postSettings(server.url, { workAuth: { status: "student" }, filters: { roles: [] } })

    expect(answer.status).toBe(400)
    expect((await answer.json()).error).toBe(
      'workAuth.status must be one of citizen, permanent-resident, f1-cpt, f1-opt, f1-stem-opt, h1b, other-needs-sponsorship.\nfilters.roles must list at least one job title keyword, such as "data analyst".',
    )
    await expect(readFile(join(dataDir, "settings.json"), "utf8")).rejects.toThrow()
    expect((await (await fetch(`${server.url}/api/feed`)).json()).shown).toHaveLength(1)
  })

  test("asks for settings when there are none yet, and shows the feed once they are saved", async () => {
    const fresh = await serveFeed({ prepared: prepareJobs(PROFILE, JOBS), dataDir, pageDir: pageFiles, port: 0 })
    try {
      const before = await (await fetch(`${fresh.url}/api/feed`)).json()
      const none = await (await fetch(`${fresh.url}/api/settings`)).json()
      await postSettings(fresh.url, { workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"] } }, fresh.token)
      const after = await (await fetch(`${fresh.url}/api/feed`)).json()

      expect([before.needsSettings, before.total, before.shown]).toEqual([true, 3, []])
      expect(none).toEqual({ settings: null })
      expect([after.needsSettings, after.shown.length]).toEqual([false, 1])
    } finally {
      await fresh.close()
    }
  })
})

// Sends a raw request, so a test can set the Host and Origin a browser on another site would send.
function rawRequest(url: string, path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const { hostname, port } = new URL(url)
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const sent = httpRequest({ hostname, port, path, method: options.method ?? "GET", headers: options.headers }, (answer) => {
      let body = ""
      answer.on("data", (chunk) => (body += String(chunk)))
      answer.on("end", () => resolve({ status: answer.statusCode ?? 0, body }))
    })
    sent.on("error", reject)
    sent.end(options.body)
  })
}

describe("serveFeed: saves that arrive together", () => {
  test("keeps every status when 100 are sent at once", async () => {
    const many = Array.from({ length: 100 }, (_, index) => job(`m${index}`))
    const busy = await serveFeed({ prepared: prepareJobs(PROFILE, many), settings: SETTINGS, dataDir, pageDir: pageFiles, port: 0 })
    try {
      const headers = { "Content-Type": "application/json", "X-Feed-Token": busy.token }
      const answers = await Promise.all(
        many.map((entry) => fetch(`${busy.url}/api/applied`, { method: "POST", headers, body: JSON.stringify({ key: entry.key, status: "applied" }) })),
      )
      const saved = JSON.parse(await readFile(join(dataDir, "applied.json"), "utf8")) as { key: string }[]

      expect(answers.map((answer) => answer.status)).toEqual(Array(100).fill(200))
      expect(new Set(saved.map((entry) => entry.key))).toEqual(new Set(many.map((entry) => entry.key)))
    } finally {
      await busy.close()
    }
  })

  test("saves settings sent together one after another, and keeps the file and the feed in step", async () => {
    const headers = { "Content-Type": "application/json", "X-Feed-Token": server.token }
    const roles = ["data analyst", "sales lead", "data engineer", "data scientist", "analyst"]
    const answers = await Promise.all(
      roles.map((role) =>
        fetch(`${server.url}/api/settings`, { method: "POST", headers, body: JSON.stringify({ workAuth: { status: "f1-opt" }, filters: { roles: [role] } }) }),
      ),
    )
    const onDisk = JSON.parse(await readFile(join(dataDir, "settings.json"), "utf8"))
    const inUse = (await (await fetch(`${server.url}/api/settings`)).json()).settings

    expect(answers.map((answer) => answer.status)).toEqual([200, 200, 200, 200, 200])
    expect(inUse).toEqual(onDisk)
    expect(onDisk.filters.roles).toEqual(["analyst"])
  })
})

describe("serveFeed: requests from other sites", () => {
  const settingsBody = JSON.stringify({ workAuth: { status: "citizen" }, filters: { roles: ["chef"] } })

  test("refuses a request whose Host is not this computer, so another site cannot read the feed by DNS rebinding", async () => {
    const answer = await rawRequest(server.url, "/api/feed", { headers: { Host: "evil.example:4317" } })

    expect(answer.status).toBe(403)
  })

  test("refuses a POST that is not JSON, as a form on another site would send, and changes nothing", async () => {
    const headers = { "Content-Type": "text/plain", "X-Feed-Token": server.token }
    const answer = await rawRequest(server.url, "/api/settings", { method: "POST", headers, body: settingsBody })

    expect(answer.status).toBe(415)
    await expect(readFile(join(dataDir, "settings.json"), "utf8")).rejects.toThrow()
  })

  test("refuses a POST sent from another site's page", async () => {
    const headers = { "Content-Type": "application/json", Origin: "https://evil.example", "X-Feed-Token": server.token }
    const answer = await rawRequest(server.url, "/api/settings", { method: "POST", headers, body: settingsBody })

    expect(answer.status).toBe(403)
  })

  test("refuses a POST without this session's token, and puts the token only in the page it serves", async () => {
    const answer = await rawRequest(server.url, "/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: settingsBody })
    const page = await (await fetch(server.url)).text()

    expect(answer.status).toBe(403)
    expect(server.token).toMatch(/^[0-9a-f]{32,}$/)
    expect(page).toContain(`<meta name="feed-token" content="${server.token}">`)
    expect(await (await fetch(`${server.url}/api/settings`)).text()).not.toContain(server.token)
  })

  test("answers a broken address with 400 and keeps running", async () => {
    const answer = await rawRequest(server.url, "//")

    expect(answer.status).toBe(400)
    expect((await fetch(`${server.url}/api/settings`)).status).toBe(200)
  })

  test("answers 500 when the page has not been built, and keeps running", async () => {
    const bare = await serveFeed({ prepared: [], settings: SETTINGS, dataDir, pageDir: await mkdtemp(join(tmpdir(), "no-page-")), port: 0 })
    try {
      expect((await fetch(bare.url)).status).toBe(500)
      expect((await fetch(`${bare.url}/api/settings`)).status).toBe(200)
    } finally {
      await bare.close()
    }
  })

  test("says so when the port is already taken, instead of waiting forever", async () => {
    const port = Number(new URL(server.url).port)

    await expect(serveFeed({ prepared: [], settings: SETTINGS, dataDir, pageDir: pageFiles, port })).rejects.toThrow(`Port ${port} is already in use.`)
  })

  test("sends headers that stop other sites from framing the page or guessing types", async () => {
    const page = await fetch(server.url)

    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
    expect(page.headers.get("x-content-type-options")).toBe("nosniff")
  })
})

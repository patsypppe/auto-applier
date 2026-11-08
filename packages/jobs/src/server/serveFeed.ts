// The local feed server: serves the page and its routes, on 127.0.0.1 only, so nothing on the network can reach it.
// GET /api/feed sends the shown jobs and hidden counts; POST /api/applied saves a status change to data/applied.json;
// GET and POST /api/settings read and save data/settings.json, and a save ranks the jobs again. Only this computer's own
// page may use it: other Hosts, other sites' pages and POSTs without JSON or the session token are refused.
import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { APPLICATION_STATUSES, setStatus, type AppliedEntry, type ApplicationStatus } from "../feed/applied"
import { applyFilters, type HideReason } from "../feed/applyFilters"
import { toCard } from "../feed/card"
import { rankJobs, type PreparedJob, type RankedJob } from "../feed/getJobs"
import { parseSettings, type FeedSettings } from "../settings"
import { readJsonFile, writeJsonFile } from "../storage/files"
import { createWriteQueue } from "../storage/writeQueue"
import { canUseStemOpt } from "../tags/effects"
import { filtersFromQuery } from "./queryFilters"

const MAX_BODY_BYTES = 10_000
const MAX_SETTINGS_BYTES = 100_000
const MAX_EXTRA = 300
const TOKEN_HEADER = "x-feed-token"
const TOKEN_SLOT = '<meta name="feed-token" content="">'

// Sent with every answer: no framing by other sites, no guessing of content types, nothing kept in caches.
const SAFE_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
}

export type FeedServerOptions = {
  prepared: readonly PreparedJob[]
  settings?: FeedSettings
  dataDir: string
  pageDir: string
  port: number
}

// What the server is ranking with right now; a settings save replaces both.
type FeedState = { settings?: FeedSettings; ranked: readonly RankedJob[] }

// Runs one save at a time, so saves that arrive together never read the same old file and overwrite each other.
type Queue = <T>(task: () => Promise<T>) => Promise<T>

const PAGE_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/page.js": { file: "page.js", type: "text/javascript; charset=utf-8" },
}

// Sends a JSON answer with the given status.
function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { ...SAFE_HEADERS, "Content-Type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

// Returns why a request must be refused, or undefined when it comes from this computer's own page. The Host check stops
// DNS rebinding; a POST must also be JSON (a form on another site cannot send that without asking first), come from no
// other site's page, and carry the token that only the page served here knows.
function refusal(request: IncomingMessage, port: number, token: string): { status: number; error: string } | undefined {
  const own = [`127.0.0.1:${port}`, `localhost:${port}`]
  if (!own.includes(request.headers.host ?? "")) return { status: 403, error: "Only this computer's own feed page may use this server." }
  if (request.method !== "POST") return undefined
  if (!(request.headers["content-type"] ?? "").startsWith("application/json")) return { status: 415, error: "Send JSON." }
  const origin = request.headers.origin
  if (origin !== undefined && !own.some((host) => origin === `http://${host}`)) return { status: 403, error: "Requests from other sites are refused." }
  if (request.headers[TOKEN_HEADER] !== token) return { status: 403, error: "The page's session token is missing or old. Reload the page." }
  return undefined
}

// Reads a page file and sends it; the page itself gets this session's token written into it.
async function sendPage(response: ServerResponse, pageDir: string, page: { file: string; type: string }, token: string): Promise<void> {
  const content = await readFile(join(pageDir, page.file), "utf8")
  response.writeHead(200, { ...SAFE_HEADERS, "Content-Type": page.type })
  response.end(page.file === "index.html" ? content.replace(TOKEN_SLOT, `<meta name="feed-token" content="${token}">`) : content)
}

// Reads a small JSON request body, or returns undefined when it is too big or not JSON.
async function readBody(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  let text = ""
  for await (const chunk of request) {
    text += String(chunk)
    if (text.length > maxBytes) return undefined
  }
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// Counts hidden jobs by reason, most common first and then by name.
function countByReason(hidden: readonly { reason: HideReason }[]): { reason: HideReason; count: number }[] {
  const counts = new Map<HideReason, number>()
  for (const { reason } of hidden) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

// Answers GET /api/feed: shown cards, hidden counts, the hidden cards for one reason when ?show= asks, the history, and
// the filters used, which are the saved ones with the page's chips put over them, and whether the STEM OPT rule applies.
// With no settings yet, it sends no jobs and says the settings are needed.
async function sendFeed(response: ServerResponse, url: URL, state: FeedState, appliedFile: string): Promise<void> {
  const applied = await readJsonFile<AppliedEntry[]>(appliedFile, [])
  const { settings } = state
  if (!settings) {
    return sendJson(response, 200, { needsSettings: true, total: state.ranked.length, shown: [], hidden: [], extra: [], applied, stemOpt: false })
  }

  let filters: FeedSettings["filters"]
  try {
    filters = filtersFromQuery(settings.filters, url.searchParams)
  } catch (error: unknown) {
    return sendJson(response, 400, { error: (error as Error).message })
  }

  const { shown, hidden } = applyFilters(state.ranked, { ...settings, filters })
  const show = url.searchParams.get("show")
  const extra = show ? hidden.filter(({ reason }) => reason === show).slice(0, MAX_EXTRA).map(({ job }) => toCard(job)) : []
  sendJson(response, 200, {
    needsSettings: false,
    total: state.ranked.length,
    shown: shown.map(toCard),
    hidden: countByReason(hidden),
    extra,
    applied,
    filters,
    stemOpt: canUseStemOpt(settings.workAuth),
  })
}

// Answers POST /api/settings: checks the settings, ranks the jobs with them, writes them to data/settings.json and only
// then puts both in use, one save at a time. Sends back the settings as saved, with defaults filled in. Nothing changes
// when they have a mistake.
async function saveSettings(request: IncomingMessage, response: ServerResponse, options: FeedServerOptions, state: FeedState, queue: Queue): Promise<void> {
  const body = await readBody(request, MAX_SETTINGS_BYTES)
  if (body === undefined) return sendJson(response, 400, { error: "Send the settings as JSON." })
  let settings: FeedSettings
  try {
    settings = parseSettings(body)
  } catch (error: unknown) {
    return sendJson(response, 400, { error: (error as Error).message })
  }

  await queue(async () => {
    const ranked = rankJobs(settings, options.prepared)
    await writeJsonFile(join(options.dataDir, "settings.json"), settings)
    state.ranked = ranked
    state.settings = settings
  })
  sendJson(response, 200, { settings })
}

// Answers POST /api/applied: checks the change, then reads the history, applies the change and saves it, one save at a
// time so that changes sent together are all kept.
async function saveStatus(request: IncomingMessage, response: ServerResponse, state: FeedState, appliedFile: string, queue: Queue): Promise<void> {
  const body = (await readBody(request)) as { key?: unknown; status?: unknown; note?: unknown } | undefined
  const statuses = [...APPLICATION_STATUSES, "none"]
  if (!body || typeof body.key !== "string") return sendJson(response, 400, { error: "Send JSON with a key and a status." })
  if (typeof body.status !== "string" || !statuses.includes(body.status)) {
    return sendJson(response, 400, { error: `status must be one of ${statuses.join(", ")}.` })
  }
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000)) {
    return sendJson(response, 400, { error: "note must be text of at most 1,000 characters." })
  }

  const key = body.key
  const saved = await queue(async () => {
    const history = await readJsonFile<AppliedEntry[]>(appliedFile, [])
    const known = state.ranked.find((entry) => entry.job.key === key)?.job ?? history.find((entry) => entry.key === key)
    if (!known) return undefined
    const job = { key: known.key, company: known.company, title: known.title, url: known.url }
    const next = setStatus(history, job, body.status as ApplicationStatus | "none", new Date(), body.note as string | undefined)
    await writeJsonFile(appliedFile, next)
    return next
  })
  if (!saved) return sendJson(response, 404, { error: `No job with key ${key}.` })
  sendJson(response, 200, { applied: saved })
}

// Turns a prepared job into a ranked one with no score, so a status can be saved before there are settings.
function unranked({ job, tags, reads, pay, history }: PreparedJob): RankedJob {
  return { job, tags, effect: "ok", score: 0, reasons: { ...reads, titleMatches: false }, ...(pay ? { pay } : {}), ...(history ? { history } : {}) }
}

// Starts the server on 127.0.0.1 and returns its address, this session's token and a way to stop it. A port that is
// already taken is reported instead of waiting.
export async function serveFeed(options: FeedServerOptions): Promise<{ url: string; token: string; close: () => Promise<void> }> {
  const appliedFile = join(options.dataDir, "applied.json")
  const state: FeedState = { settings: options.settings, ranked: options.settings ? rankJobs(options.settings, options.prepared) : options.prepared.map(unranked) }
  const token = randomBytes(16).toString("hex")
  const queue = createWriteQueue()
  let port = options.port

  const server = createServer((request, response) => {
    const answer = async () => {
      const refused = refusal(request, port, token)
      if (refused) return sendJson(response, refused.status, { error: refused.error })
      const url = URL.canParse(request.url ?? "/", "http://127.0.0.1") ? new URL(request.url ?? "/", "http://127.0.0.1") : undefined
      if (!url) return sendJson(response, 400, { error: "That address cannot be read." })
      const page = PAGE_FILES[url.pathname]
      if (request.method === "GET" && page) return sendPage(response, options.pageDir, page, token)
      if (request.method === "GET" && url.pathname === "/api/feed") return sendFeed(response, url, state, appliedFile)
      if (request.method === "POST" && url.pathname === "/api/applied") return saveStatus(request, response, state, appliedFile, queue)
      if (request.method === "GET" && url.pathname === "/api/settings") return sendJson(response, 200, { settings: state.settings ?? null })
      if (request.method === "POST" && url.pathname === "/api/settings") return saveSettings(request, response, options, state, queue)
      sendJson(response, 404, { error: "Not found." })
    }
    answer().catch((error: unknown) => {
      if (response.headersSent) return void response.destroy()
      sendJson(response, 500, { error: error instanceof Error ? error.message : "Something went wrong." })
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => reject(error.code === "EADDRINUSE" ? new Error(`Port ${options.port} is already in use.`) : error))
    server.listen(options.port, "127.0.0.1", () => resolve())
  })
  port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}`,
    token,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}

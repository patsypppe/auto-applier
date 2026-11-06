// The local feed server: serves the page and two routes, on 127.0.0.1 only, so nothing on the network can reach it.
// GET /api/feed sends the shown jobs and hidden counts; POST /api/applied saves a status change to data/applied.json.
import { readFile } from "node:fs/promises"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { join } from "node:path"
import { APPLICATION_STATUSES, setStatus, type AppliedEntry, type ApplicationStatus } from "../feed/applied"
import { applyFilters, type HideReason } from "../feed/applyFilters"
import { toCard } from "../feed/card"
import type { RankedJob } from "../feed/getJobs"
import type { FeedSettings } from "../settings"
import { readJsonFile, writeJsonFile } from "../storage/files"
import { canUseStemOpt } from "../tags/effects"
import { filtersFromQuery } from "./queryFilters"

const MAX_BODY_BYTES = 10_000
const MAX_EXTRA = 300

export type FeedServerOptions = {
  ranked: readonly RankedJob[]
  settings: FeedSettings
  dataDir: string
  pageDir: string
  port: number
}

const PAGE_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/page.js": { file: "page.js", type: "text/javascript; charset=utf-8" },
}

// Sends a JSON answer with the given status.
function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

// Reads a small JSON request body, or returns undefined when it is too big or not JSON.
async function readBody(request: IncomingMessage): Promise<unknown> {
  let text = ""
  for await (const chunk of request) {
    text += String(chunk)
    if (text.length > MAX_BODY_BYTES) return undefined
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
async function sendFeed(response: ServerResponse, url: URL, options: FeedServerOptions, appliedFile: string): Promise<void> {
  let filters: FeedSettings["filters"]
  try {
    filters = filtersFromQuery(options.settings.filters, url.searchParams)
  } catch (error: unknown) {
    return sendJson(response, 400, { error: (error as Error).message })
  }

  const { shown, hidden } = applyFilters(options.ranked, { ...options.settings, filters })
  const show = url.searchParams.get("show")
  const extra = show ? hidden.filter(({ reason }) => reason === show).slice(0, MAX_EXTRA).map(({ job }) => toCard(job)) : []
  sendJson(response, 200, {
    total: options.ranked.length,
    shown: shown.map(toCard),
    hidden: countByReason(hidden),
    extra,
    applied: await readJsonFile<AppliedEntry[]>(appliedFile, []),
    filters,
    stemOpt: canUseStemOpt(options.settings.workAuth),
  })
}

// Answers POST /api/applied: checks the change, applies it to the history and saves the history.
async function saveStatus(request: IncomingMessage, response: ServerResponse, options: FeedServerOptions, appliedFile: string): Promise<void> {
  const body = (await readBody(request)) as { key?: unknown; status?: unknown; note?: unknown } | undefined
  const statuses = [...APPLICATION_STATUSES, "none"]
  if (!body || typeof body.key !== "string") return sendJson(response, 400, { error: "Send JSON with a key and a status." })
  if (typeof body.status !== "string" || !statuses.includes(body.status)) {
    return sendJson(response, 400, { error: `status must be one of ${statuses.join(", ")}.` })
  }
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 1000)) {
    return sendJson(response, 400, { error: "note must be text of at most 1,000 characters." })
  }

  const history = await readJsonFile<AppliedEntry[]>(appliedFile, [])
  const listed = options.ranked.find((entry) => entry.job.key === body.key)?.job
  const known = listed ?? history.find((entry) => entry.key === body.key)
  if (!known) return sendJson(response, 404, { error: `No job with key ${body.key}.` })

  const job = { key: known.key, company: known.company, title: known.title, url: known.url }
  const next = setStatus(history, job, body.status as ApplicationStatus | "none", new Date(), body.note as string | undefined)
  await writeJsonFile(appliedFile, next)
  sendJson(response, 200, { applied: next })
}

// Starts the server on 127.0.0.1 and returns its address and a way to stop it.
export async function serveFeed(options: FeedServerOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const appliedFile = join(options.dataDir, "applied.json")

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    const page = PAGE_FILES[url.pathname]
    const answer = async () => {
      if (request.method === "GET" && page) {
        response.writeHead(200, { "Content-Type": page.type })
        return void response.end(await readFile(join(options.pageDir, page.file)))
      }
      if (request.method === "GET" && url.pathname === "/api/feed") return sendFeed(response, url, options, appliedFile)
      if (request.method === "POST" && url.pathname === "/api/applied") return saveStatus(request, response, options, appliedFile)
      sendJson(response, 404, { error: "Not found." })
    }
    answer().catch((error: unknown) => sendJson(response, 500, { error: error instanceof Error ? error.message : "Something went wrong." }))
  })

  await new Promise<void>((resolve) => server.listen(options.port, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  }
}

// Fetches JSON from a job board politely: one fixed user agent, a timeout, and retries only for temporary failures.
import { isRetryableStatus } from "@auto-applier/core"

export const USER_AGENT = "Mozilla/5.0 (compatible; job-feed/0.1)"
export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1000, 3000, 9000]
const DEFAULT_TIMEOUT_MS = 30_000

export type FetchOptions = {
  label: string
  body?: unknown
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  delaysMs?: readonly number[]
  timeoutMs?: number
  now?: () => Date
}

const MAX_RETRY_AFTER_MS = 60_000

// One try: the board answered with a status (and, when it was OK, the JSON it sent), or the connection dropped.
type Attempt = { status: number; retryAfter: string | null; json?: unknown } | { dropped: string }

// A failed request that also carries the HTTP status, when there was one, so a 404 can be told apart from a busy server.
export class RequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "RequestError"
    this.status = status
  }
}

// Waits for the given number of milliseconds.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Builds the request: a GET, or a POST with a JSON body when one is given.
function requestInit(body: unknown, signal: AbortSignal): RequestInit {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "application/json" }
  if (body === undefined) return { method: "GET", headers, signal }

  return { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body), signal }
}

// Rejects once the signal aborts, so a body that stops arriving cannot hold the run up past the timeout.
function abortedAfter(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })
  })
}

// Reads the body as JSON, or says the board answered with something else, such as a sign-in page.
async function readJson(response: Response, signal: AbortSignal, label: string): Promise<unknown> {
  try {
    return await Promise.race([response.json(), abortedAfter(signal)])
  } catch {
    throw new Error(signal.aborted ? `${label} did not answer in time.` : `${label} did not answer with JSON.`)
  }
}

// Sends one request and, when it worked, reads its body, all within the timeout. A dropped connection becomes a value.
async function attempt(url: string, options: FetchOptions, fetchFn: typeof fetch): Promise<Attempt> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetchFn(url, requestInit(options.body, controller.signal))
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new Error(`${options.label} did not answer in time.`)
      return { dropped: error instanceof Error ? error.message : "unknown error" }
    }

    const retryAfter = response.headers.get("Retry-After")
    if (!response.ok) return { status: response.status, retryAfter }
    return { status: response.status, retryAfter, json: await readJson(response, controller.signal, options.label) }
  } finally {
    clearTimeout(timer)
  }
}

// Returns how long the site asked us to wait, from a number of seconds or a date, or undefined when it did not say.
function retryAfterMs(header: string | null, now: Date): number | undefined {
  if (header === null) return undefined
  const seconds = Number(header)
  if (header.trim() !== "" && Number.isFinite(seconds)) return seconds * 1000

  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : date - now.getTime()
}

// Builds the error for a status that will not get better by asking again.
function statusError(label: string, status: number): RequestError {
  const hint = status === 404 ? " It was not found, so the board may have moved or closed." : ""
  return new RequestError(`${label} returned ${status}.${hint}`, status)
}

// Fetches the URL and returns its JSON, waiting and retrying after temporary failures, once per delay.
export async function fetchJson(url: string, options: FetchOptions): Promise<unknown> {
  // Wrapped in an arrow so the global fetch is not called as a method of the options object.
  const fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
  const sleep = options.sleep ?? wait
  const delays = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS

  for (let tries = 1; ; tries += 1) {
    const result = await attempt(url, options, fetchFn)
    if ("json" in result) return result.json
    if ("status" in result && !isRetryableStatus(result.status)) throw statusError(options.label, result.status)

    const delay = delays[tries - 1]
    if (delay === undefined) {
      const status = "status" in result ? result.status : undefined
      const reason = status !== undefined ? `returned ${status}` : `could not be reached (${"dropped" in result ? result.dropped : ""})`
      throw new RequestError(`${options.label} ${reason} after ${tries} tries.`, status)
    }

    // A site that says how long to wait gets at least that long, up to a minute.
    const asked = "status" in result ? retryAfterMs(result.retryAfter, (options.now ?? (() => new Date()))()) : undefined
    await sleep(Math.min(Math.max(delay, asked ?? 0), MAX_RETRY_AFTER_MS))
  }
}

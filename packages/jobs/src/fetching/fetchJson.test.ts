// Tests that fetchJson sends one polite request, retries temporary failures with growing waits, and explains failures.
import { describe, expect, test, vi } from "vitest"
import { fetchBytes, fetchJson, fetchText, RequestError, USER_AGENT } from "./fetchJson"

const URL = "https://boards-api.greenhouse.io/v1/boards/acme/jobs"
const LABEL = "Greenhouse board 'acme'"

// Builds a fetch stand-in that answers with each status in turn, then with the last one forever.
function fetchAnswering(...statuses: number[]) {
  const remaining = [...statuses]
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const status = remaining.length > 1 ? remaining.shift()! : remaining[0]!
    return new Response(JSON.stringify({ status }), { status })
  })
}

// Builds a sleep stand-in that returns at once and remembers the waits.
function fakeSleep() {
  return vi.fn(async (_ms: number) => undefined)
}

describe("fetchJson: a good answer", () => {
  test("returns the body parsed as JSON", async () => {
    const result = await fetchJson(URL, { label: LABEL, fetchFn: fetchAnswering(200), sleep: fakeSleep() })

    expect(result).toEqual({ status: 200 })
  })

  test("sends the fixed user agent and asks for JSON", async () => {
    const fetchFn = fetchAnswering(200)

    await fetchJson(URL, { label: LABEL, fetchFn, sleep: fakeSleep() })

    const [url, init] = fetchFn.mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(url).toBe(URL)
    expect(headers["User-Agent"]).toBe(USER_AGENT)
    expect(headers.Accept).toBe("application/json")
  })

  test("posts a JSON body when one is given", async () => {
    const fetchFn = fetchAnswering(200)

    await fetchJson(URL, { label: LABEL, body: { limit: 20 }, fetchFn, sleep: fakeSleep() })

    const [, init] = fetchFn.mock.calls[0]!
    expect(init?.method).toBe("POST")
    expect(init?.body).toBe('{"limit":20}')
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
  })
})

describe("fetchText", () => {
  test("returns the body as text, such as a CSV file, and asks for any type", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("a,b\n1,2\n", { status: 200 }))

    const result = await fetchText(URL, { label: LABEL, fetchFn, sleep: fakeSleep() })

    expect(result).toBe("a,b\n1,2\n")
    expect((fetchFn.mock.calls[0]![1]?.headers as Record<string, string>).Accept).toBe("*/*")
  })

  test("retries a busy server the same way", async () => {
    const answers = [new Response("", { status: 503 }), new Response("done", { status: 200 })]
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => answers.shift()!)
    const sleep = fakeSleep()

    expect(await fetchText(URL, { label: LABEL, fetchFn, sleep })).toBe("done")
    expect(sleep).toHaveBeenCalledWith(1000)
  })
})

describe("fetchBytes", () => {
  test("sends the extra headers, such as a byte range, and returns the bytes", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(new Uint8Array([31, 139, 8]), { status: 206 }))

    const result = await fetchBytes(URL, { label: LABEL, headers: { Range: "bytes=10-12" }, fetchFn, sleep: fakeSleep() })

    expect([...result]).toEqual([31, 139, 8])
    expect((fetchFn.mock.calls[0]![1]?.headers as Record<string, string>).Range).toBe("bytes=10-12")
  })
})

describe("fetchJson: temporary failures", () => {
  test("waits 1 s, then 3 s, and returns the answer once it works", async () => {
    const fetchFn = fetchAnswering(503, 429, 200)
    const sleep = fakeSleep()

    const result = await fetchJson(URL, { label: LABEL, fetchFn, sleep })

    expect(result).toEqual({ status: 200 })
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 3000])
  })

  test("gives up after the last wait and says what the server answered", async () => {
    const fetchFn = fetchAnswering(502)
    const sleep = fakeSleep()

    await expect(fetchJson(URL, { label: LABEL, fetchFn, sleep })).rejects.toThrow(
      "Greenhouse board 'acme' returned 502 after 4 tries.",
    )
    expect(fetchFn).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 3000, 9000])
  })

  test("retries a dropped connection", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))

    const result = await fetchJson(URL, { label: LABEL, fetchFn, sleep: fakeSleep() })

    expect(result).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})

describe("fetchJson: Retry-After", () => {
  // Builds a fetch stand-in that answers 429 with the given Retry-After header once, then 200.
  function busyOnce(retryAfter: string) {
    return vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": retryAfter } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
  }

  test("waits as long as the site asks when that is longer than the usual wait", async () => {
    const sleep = fakeSleep()

    await fetchJson(URL, { label: LABEL, fetchFn: busyOnce("20"), sleep })

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([20_000])
  })

  test("never waits more than a minute, however long the site asks for", async () => {
    const sleep = fakeSleep()

    await fetchJson(URL, { label: LABEL, fetchFn: busyOnce("3600"), sleep })

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([60_000])
  })

  test("reads a Retry-After written as a date", async () => {
    const sleep = fakeSleep()
    const now = new Date("2026-11-04T12:00:00Z")

    await fetchJson(URL, { label: LABEL, fetchFn: busyOnce("Wed, 04 Nov 2026 12:00:30 GMT"), sleep, now: () => now })

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([30_000])
  })

  test("keeps the usual wait when the site asks for less, or says nothing it can read", async () => {
    const sleep = fakeSleep()

    await fetchJson(URL, { label: LABEL, fetchFn: busyOnce("soon"), sleep })

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000])
  })
})

describe("fetchJson: permanent failures", () => {
  test("stops waiting for a body that never finishes arriving", async () => {
    const endless = new ReadableStream({ start: () => undefined })
    const fetchFn = vi.fn(async () => new Response(endless, { status: 200 }))

    await expect(fetchJson(URL, { label: LABEL, fetchFn, sleep: fakeSleep(), timeoutMs: 20 })).rejects.toThrow(
      "Greenhouse board 'acme' did not answer in time.",
    )
  })

  test("does not retry a 404 and says the board was not found", async () => {
    const fetchFn = fetchAnswering(404)
    const sleep = fakeSleep()

    await expect(fetchJson(URL, { label: LABEL, fetchFn, sleep })).rejects.toThrow(
      "Greenhouse board 'acme' returned 404. It was not found, so the board may have moved or closed.",
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  test("puts the status on the error so a caller can tell a missing board from a busy one", async () => {
    const error: unknown = await fetchJson(URL, { label: LABEL, fetchFn: fetchAnswering(404), sleep: fakeSleep() }).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(RequestError)
    expect((error as RequestError).status).toBe(404)
  })

  test("refuses an answer that is not JSON", async () => {
    const fetchFn = vi.fn(async () => new Response("<html>Sign in</html>", { status: 200 }))

    await expect(fetchJson(URL, { label: LABEL, fetchFn, sleep: fakeSleep() })).rejects.toThrow(
      "Greenhouse board 'acme' did not answer with JSON.",
    )
  })

  test("stops waiting after the timeout and does not retry", async () => {
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }),
    )

    await expect(fetchJson(URL, { label: LABEL, fetchFn, sleep: fakeSleep(), timeoutMs: 5 })).rejects.toThrow(
      "Greenhouse board 'acme' did not answer in time.",
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})

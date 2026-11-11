// Reads the local server's answers to the page, turning every outcome, including no answer at all, into a body or a sentence.

export type Answer<T> = { ok: true; body: T } | { ok: false; error: string; status?: number }

// Returns the server's own error sentence from an answer body, when it has one.
function errorIn(body: unknown): string | undefined {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined
  return typeof error === "string" && error !== "" ? error : undefined
}

// Waits for a request and returns its JSON body when the server accepted it and the body has the expected shape. Otherwise
// returns a sentence that starts with what failed and says why: no answer, the server's own error, or the HTTP status.
export async function readAnswer<T>(request: Promise<Response>, accepts: (body: unknown) => body is T, what: string): Promise<Answer<T>> {
  let response: Response
  try {
    response = await request
  } catch {
    return { ok: false, error: `${what}: the feed server did not answer. Check that it is still running, then reload the page.` }
  }
  const body: unknown = await response.json().catch(() => undefined)
  if (response.ok && accepts(body)) return { ok: true, body }
  const said = errorIn(body)
  return { ok: false, status: response.status, error: said ? `${what}: ${said}` : `${what} (the server answered with HTTP ${response.status}).` }
}

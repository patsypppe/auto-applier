// Streams a large text file line by line, so a file of 100 MB, such as Common Crawl's index lookup, is never held whole.
import { RequestError, USER_AGENT } from "./fetchJson"

// Yields the file's lines as they arrive. A failed answer throws; a dropped stream is not retried, since it would restart.
export async function* fetchLines(url: string, label: string, fetchFn: typeof fetch = (input, init) => fetch(input, init)): AsyncGenerator<string> {
  const response = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } })
  if (!response.ok || !response.body) throw new RequestError(`${label} returned ${response.status}.`, response.status)

  let rest = ""
  for await (const piece of response.body.pipeThrough(new TextDecoderStream())) {
    const lines = (rest + piece).split("\n")
    rest = lines.pop() ?? ""
    yield* lines
  }
  if (rest !== "") yield rest
}

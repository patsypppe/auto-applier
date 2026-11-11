// Tests that fetchLines streams a large text file line by line and explains a failed answer.
import { describe, expect, test, vi } from "vitest"
import { fetchLines } from "./fetchLines"

// Builds a fetch stand-in whose answer arrives in the given pieces.
function fetchInPieces(pieces: string[], status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece))
        controller.close()
      },
    })
    return new Response(body, { status })
  })
}

// Collects every line the generator yields.
async function all(lines: AsyncIterable<string>): Promise<string[]> {
  const found: string[] = []
  for await (const line of lines) found.push(line)
  return found
}

describe("fetchLines", () => {
  test("joins lines that arrive split across pieces", async () => {
    const fetchFn = fetchInPieces(["first li", "ne\nsecond\nthi", "rd"])

    expect(await all(fetchLines("https://example.test/big.idx", "The index", fetchFn))).toEqual(["first line", "second", "third"])
  })

  test("names the file and status when the answer is not OK", async () => {
    await expect(all(fetchLines("https://example.test/big.idx", "The index", fetchInPieces([], 404)))).rejects.toThrow("The index returned 404.")
  })
})

// Finds Greenhouse, Lever, Ashby and Workday boards in Common Crawl's URL index: which index blocks to read, and the
// boards named by the page addresses in a block.
import type { Company } from "../types"
import { mergeCompanies } from "./buildCompanyList"
import { boardFromUrl } from "./readListings"

export const COMMONCRAWL_SOURCE = "commoncrawl"
export type IndexBlock = { file: string; offset: number; length: number }

// Index keys write the host backwards, so every page on one of these job sites starts with one of these keys.
const JOB_SITE_KEYS = [
  "co,lever,eu,jobs)/",
  "co,lever,jobs)/",
  "com,ashbyhq,jobs)/",
  "com,myworkdayjobs,",
  "io,greenhouse,boards)/",
  "io,greenhouse,job-boards)/",
]
const NOT_BOARDS = new Set(["robots.txt", "favicon.ico", "sitemap.xml"])
const MAX_CRAWLS = 10

// Returns a row's key: the reversed address, without the timestamp after it.
function keyOf(row: string): string {
  return row.slice(0, row.indexOf(" "))
}

// Returns true when a block whose keys run from one key up to the next can hold a page on a job site.
function holdsJobSite(from: string, to: string): boolean {
  return JOB_SITE_KEYS.some((start) => from < `${start}￿` && to > start)
}

// Reads the lookup file's rows (first key, file, offset, length) and returns the blocks that can hold job-site pages.
// A block runs to the next row's key, so the last row has no end; it lies far past the job sites and is never needed.
export async function blocksForJobSites(rows: Iterable<string> | AsyncIterable<string>): Promise<IndexBlock[]> {
  const blocks: IndexBlock[] = []
  let previous: string[] | undefined
  for await (const row of rows) {
    const cells = row.split("\t")
    if (cells.length < 4) continue
    if (previous && holdsJobSite(keyOf(previous[0]!), keyOf(cells[0]!))) {
      blocks.push({ file: previous[1]!, offset: Number(previous[2]), length: Number(previous[3]) })
    }
    previous = cells
  }
  return blocks
}

// Returns the board a page address names, or undefined for other sites, robots.txt files and Greenhouse's page for a
// board that is gone (it sends visitors to ?error=true).
function boardFromAddress(address: string): Company | undefined {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return undefined
  }
  if (url.searchParams.get("error") === "true") return undefined
  const board = boardFromUrl(address)
  if (!board || NOT_BOARDS.has(board.slug.split("|").at(-1)!.toLowerCase())) return undefined
  return { ...board, name: board.slug, sources: [COMMONCRAWL_SOURCE] }
}

// Reads one block of the index (lines of key, timestamp and a JSON record with the page's address) into one board per slug.
export function boardsInBlock(text: string): Company[] {
  const boards: Company[] = []
  for (const line of text.split("\n")) {
    if (!JOB_SITE_KEYS.some((start) => line.startsWith(start))) continue
    let record: unknown
    try {
      record = JSON.parse(line.slice(line.indexOf("{")))
    } catch {
      continue
    }
    const address = (record as { url?: unknown }).url
    const board = typeof address === "string" ? boardFromAddress(address) : undefined
    if (board) boards.push(board)
  }
  return mergeCompanies([boards], [])
}

// Reads --crawls from the arguments: how many of the newest crawls to search, one by default.
export function crawlsFrom(args: readonly string[]): number {
  const index = args.indexOf("--crawls")
  const crawls = index === -1 ? 1 : Number(args[index + 1])
  if (!Number.isInteger(crawls) || crawls < 1 || crawls > MAX_CRAWLS) throw new Error(`--crawls must be a whole number from 1 to ${MAX_CRAWLS}, for example --crawls 3.`)
  return crawls
}

// Returns the ids of the newest crawls from Common Crawl's list of crawls, which starts with the newest.
export function pickCrawls(raw: unknown, count: number): string[] {
  if (!Array.isArray(raw)) throw new Error("Common Crawl's list of crawls was not a list.")
  return raw
    .map((crawl: unknown) => (crawl as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id.startsWith("CC-MAIN-"))
    .slice(0, count)
}

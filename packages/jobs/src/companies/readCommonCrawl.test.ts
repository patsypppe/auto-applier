// Tests reading job boards out of Common Crawl's URL index, using real lookup rows and real index lines from crawl 2026-43.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { blocksForJobSites, boardsInBlock, crawlsFrom, pickCrawls } from "./readCommonCrawl"

const FIXTURES = join(import.meta.dirname, "../../test/fixtures")
const CLUSTER = readFileSync(join(FIXTURES, "commoncrawl-cluster.idx"), "utf8").trim().split("\n")
const LINES = readFileSync(join(FIXTURES, "commoncrawl-index-lines.txt"), "utf8")

describe("blocksForJobSites", () => {
  test("picks the index blocks whose keys can hold a Lever or Ashby job page, and no others", async () => {
    expect(await blocksForJobSites(CLUSTER)).toEqual([
      { file: "cdx-00027.gz", offset: 164839536, length: 282551 },
      { file: "cdx-00037.gz", offset: 576196234, length: 327944 },
      { file: "cdx-00037.gz", offset: 576524178, length: 306984 },
    ])
  })

  test("reads the rows as they stream in", async () => {
    async function* streamed() {
      yield* CLUSTER
    }

    expect(await blocksForJobSites(streamed())).toHaveLength(3)
  })
})

describe("boardsInBlock", () => {
  test("reads one board per job site and slug from the page addresses", () => {
    const boards = boardsInBlock(LINES).map((board) => `${board.ats}:${board.slug}`)

    expect(boards.sort()).toEqual([
      "ashby:beaconsoftware",
      "ashby:crusoe",
      "ashby:directive",
      "ashby:livekit",
      "ashby:taxfix.com",
      "ashby:xero",
      "greenhouse:abinbev",
      "greenhouse:addepar1",
      "greenhouse:adyen",
      "greenhouse:alertmedia",
      "greenhouse:andurilindustries",
      "lever:abtasty",
      "lever:animocabrands",
      "lever:c12qe",
      "lever:clearer",
      "lever:medacuitysoftware",
      "lever:terrahq",
      "lever:xsolla",
      "workday:abbott|wd5|abbottcareers",
      "workday:adobe|wd5|external_experienced",
      "workday:allstate|wd5|agent",
      "workday:astreya|wd5|life-at-astreya-opportunities",
      "workday:zuehlke|wd3|zuhlke-careers",
    ])
  })

  test("skips robots.txt files, Greenhouse's page for a board that is gone, and other sites", () => {
    const slugs = boardsInBlock(LINES).map((board) => board.slug)

    expect(slugs).not.toContain("robots.txt")
    expect(slugs).not.toContain("0verwatch")
    expect(slugs.some((slug) => slug.startsWith("aaamidatlantic"))).toBe(false)
    expect(slugs.some((slug) => slug.includes("harvestdocs") || slug.includes("ashcanart"))).toBe(false)
  })

  test("marks each board as found in Common Crawl and names it after its slug", () => {
    expect(boardsInBlock(LINES).find((board) => board.slug === "xero")).toEqual({
      name: "xero",
      ats: "ashby",
      slug: "xero",
      sources: ["commoncrawl"],
    })
  })
})

describe("crawlsFrom and pickCrawls", () => {
  test("reads --crawls, one by default, and refuses anything but a whole number from 1 to 10", () => {
    expect(crawlsFrom([])).toBe(1)
    expect(crawlsFrom(["--with-commoncrawl", "--crawls", "3"])).toBe(3)
    expect(() => crawlsFrom(["--crawls", "11"])).toThrow("--crawls must be a whole number from 1 to 10")
  })

  test("takes the newest crawls from Common Crawl's list, which starts with the newest", () => {
    const list = [{ id: "CC-MAIN-2026-43" }, { id: "CC-MAIN-2026-39" }, { id: "CC-MAIN-2026-34" }]

    expect(pickCrawls(list, 2)).toEqual(["CC-MAIN-2026-43", "CC-MAIN-2026-39"])
    expect(() => pickCrawls({ crawls: [] }, 1)).toThrow("Common Crawl's list of crawls was not a list.")
  })
})

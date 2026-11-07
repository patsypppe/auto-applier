// Tests that boardFromUrl and readListings find job boards in the links of a public listings file.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { boardFromUrl, readListings } from "./readListings"

const LISTINGS = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/simplify-listings.json"), "utf8"))

describe("boardFromUrl", () => {
  test.each([
    ["https://job-boards.greenhouse.io/matx/jobs/5146786008", { ats: "greenhouse", slug: "matx" }],
    ["https://boards.greenhouse.io/andurilindustries/jobs/5071873007", { ats: "greenhouse", slug: "andurilindustries" }],
    ["https://job-boards.eu.greenhouse.io/polyai/jobs/4802138101", { ats: "greenhouse", slug: "polyai" }],
    ["https://boards.greenhouse.io/embed/job_app?for=gemini&token=7951195&gh_jid=7951195", { ats: "greenhouse", slug: "gemini" }],
    ["https://jobs.lever.co/schmidt-entities/c42b4c52-d92a-4bd6-bac6-6b2d94159b35/apply", { ats: "lever", slug: "schmidt-entities" }],
    ["https://jobs.eu.lever.co/cirrus/21ace8b0-4a6f-45fa-9299-cf72e1c51340/apply", { ats: "lever", slug: "cirrus", region: "eu" }],
    [
      "https://jobs.ashbyhq.com/fundamentalresearchlabs/8d460b28-233d-4305-a708-cf547ec3285e/application?embed=true",
      { ats: "ashby", slug: "fundamentalresearchlabs" },
    ],
    ["https://jobs.ashbyhq.com/Nascent/8454aeb0", { ats: "ashby", slug: "nascent" }],
    ["https://jobs.lever.co/xpansiv%20/4b0c7f3e", { ats: "lever", slug: "xpansiv" }],
    ["https://jobs.ashbyhq.com/bad%zz/1", { ats: "ashby", slug: "bad%zz" }],
    ["https://avav.wd1.myworkdayjobs.com/en-US/avav/job/Albuquerque-NM/RF-PCB-Layout-Engineer_9319", { ats: "workday", slug: "avav|wd1|avav" }],
    ["https://fourseasons.wd3.myworkdayjobs.com/search/job/Toronto/Analyst_REQ10374076", { ats: "workday", slug: "fourseasons|wd3|search" }],
  ])("reads %s", (url, board) => {
    expect(boardFromUrl(url)).toEqual(board)
  })

  test.each([
    ["https://boards.greenhouse.io/embed/job_app?token=7669159003"],
    ["https://www.interstates.com/careers/jobs?gh_jid=4178960009"],
    ["https://wd5.myworkdaysite.com/recruiting/acme/careers/job/Austin/Analyst_R1"],
    ["https://careers-lmi.icims.com/jobs/13752/job"],
    ["not a url"],
  ])("finds no board it can read in %s", (url) => {
    expect(boardFromUrl(url)).toBeUndefined()
  })
})

describe("readListings", () => {
  test("lists each board once with the company's name, closed listings included", () => {
    const { companies } = readListings(LISTINGS, "simplify-new-grad")

    expect(companies).toEqual([
      { name: "MatX", ats: "greenhouse", slug: "matx", sources: ["simplify-new-grad"] },
      { name: "Fundamental Research Labs", ats: "ashby", slug: "fundamentalresearchlabs", sources: ["simplify-new-grad"] },
      { name: "Schmidt Sciences", ats: "lever", slug: "schmidt-entities", sources: ["simplify-new-grad"] },
      { name: "Anduril", ats: "greenhouse", slug: "andurilindustries", sources: ["simplify-new-grad"] },
      { name: "PolyAI", ats: "greenhouse", slug: "polyai", sources: ["simplify-new-grad"] },
      { name: "Cirrus Logic", ats: "lever", slug: "cirrus", region: "eu", sources: ["simplify-new-grad"] },
      { name: "Nascent", ats: "ashby", slug: "nascent", sources: ["simplify-new-grad"] },
      { name: "Gemini", ats: "greenhouse", slug: "gemini", sources: ["simplify-new-grad"] },
      { name: "Four Seasons", ats: "workday", slug: "fourseasons|wd3|search", sources: ["simplify-new-grad"] },
    ])
  })

  test("counts the links that point to sites it cannot read", () => {
    const { unreadable } = readListings(LISTINGS, "simplify-new-grad")

    expect(unreadable).toBe(3)
  })

  test("refuses a file that is not a list of listings", () => {
    expect(() => readListings({ listings: [] }, "simplify-new-grad")).toThrow(
      "The simplify-new-grad file is not a list of listings.",
    )
  })
})

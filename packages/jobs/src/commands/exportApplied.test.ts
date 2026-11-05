// Tests that toCsv writes the application history as a spreadsheet, quoting text that holds commas or quotes.
import { describe, expect, test } from "vitest"
import type { AppliedEntry } from "../feed/applied"
import { toCsv } from "./exportApplied"

const ENTRY: AppliedEntry = {
  key: "greenhouse:acme:1",
  company: "Acme, Inc.",
  title: 'Data Analyst "Growth"',
  url: "https://boards.example/1",
  status: "interviewing",
  changes: [
    { status: "applied", date: "2026-11-02T15:00:00.000Z" },
    { status: "interviewing", date: "2026-11-06T18:00:00.000Z" },
  ],
  note: "Referred",
}

describe("toCsv", () => {
  test("writes a header and one row per job, with the first and latest dates", () => {
    expect(toCsv([ENTRY]).split("\n")).toEqual([
      "company,title,status,first date,latest date,note,link",
      '"Acme, Inc.","Data Analyst ""Growth""",interviewing,2026-11-02,2026-11-06,Referred,https://boards.example/1',
      "",
    ])
  })

  test("writes only the header when nothing is tracked", () => {
    expect(toCsv([])).toBe("company,title,status,first date,latest date,note,link\n")
  })

  test("stops a spreadsheet from running a cell that starts with = as a formula", () => {
    expect(toCsv([{ ...ENTRY, note: "=HYPERLINK(1)" }])).toContain(",'=HYPERLINK(1),")
  })
})

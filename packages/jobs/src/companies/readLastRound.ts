// Reads LastRound AI's ATS company directory (CC BY 4.0), a CSV of Greenhouse, Lever and Ashby boards, into companies.
import { cells } from "../history/readH1bCsv"
import type { Ats, Company } from "../types"

export const LASTROUND_SOURCE = "lastround"
const COLUMNS = ["ats_vendor", "company_name", "board_slug"] as const
const SITES: readonly Ats[] = ["greenhouse", "lever", "ashby"]

// Returns the boards in the directory, and how many rows were skipped for naming another job site or no slug.
export function readLastRound(text: string): { companies: Company[]; skipped: number } {
  const [header = "", ...rows] = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "")
  const names = cells(header).map((name) => name.trim())
  const [vendorAt, nameAt, slugAt] = COLUMNS.map((column) => {
    const index = names.indexOf(column)
    if (index === -1) throw new Error(`The LastRound directory has no ${column} column. Its columns are now: ${names.join(", ")}.`)
    return index
  })

  const companies: Company[] = []
  let skipped = 0
  for (const row of rows) {
    const values = cells(row)
    const ats = values[vendorAt!]?.trim().toLowerCase() as Ats
    const slug = values[slugAt!]?.trim().toLowerCase() ?? ""
    if (!SITES.includes(ats) || slug === "") {
      skipped += 1
      continue
    }
    const name = values[nameAt!]?.trim() || slug
    companies.push({ name, ats, slug, sources: [LASTROUND_SOURCE] })
  }
  return { companies, skipped }
}

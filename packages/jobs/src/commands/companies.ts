// The "companies" command: downloads the public listing files and writes data/companies.json, one entry per board.
import { join } from "node:path"
import { mergeCompanies, readAggregatorList } from "../companies/buildCompanyList"
import { readLastRound } from "../companies/readLastRound"
import { readListings } from "../companies/readListings"
import { fetchJson, fetchText } from "../fetching/fetchJson"
import { readCompanyFile, writeJsonFile } from "../storage/files"
import type { Ats, Company } from "../types"

const SIMPLIFY_LISTS = [
  {
    source: "simplify-new-grad",
    url: "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json",
  },
  {
    source: "simplify-internships",
    url: "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json",
  },
]

const AGGREGATOR_URL = "https://raw.githubusercontent.com/Riley-Dorrington/job-board-aggregator/main/data"
const AGGREGATOR_SITES: readonly Ats[] = ["greenhouse", "lever", "ashby", "workday"]

// The monthly file's name carries its month, so a newer month means changing this address.
const LASTROUND_URL =
  "https://datahub.io/lastroundai-hiring-data/lastroundai-hiring-data/_r/-/ats-directory/lastroundai-ats-company-directory-2026-08.csv"

// Downloads both Simplify listing files and reads the boards out of them.
async function simplifyCompanies(print: (line: string) => void): Promise<Company[][]> {
  const lists: Company[][] = []
  for (const list of SIMPLIFY_LISTS) {
    const raw = await fetchJson(list.url, { label: `The ${list.source} file` })
    const { companies, unreadable } = readListings(raw, list.source)
    print(`${list.source}: ${companies.length} boards, ${unreadable} links on other job sites`)
    lists.push(companies)
  }
  return lists
}

// Downloads the aggregator's plain slug lists, which are much longer and mostly not tech companies.
async function aggregatorCompanies(print: (line: string) => void): Promise<Company[][]> {
  const lists: Company[][] = []
  for (const ats of AGGREGATOR_SITES) {
    const raw = await fetchJson(`${AGGREGATOR_URL}/${ats}_companies.json`, { label: `The aggregator ${ats} file` })
    const companies = readAggregatorList(ats, raw, "aggregator")
    print(`aggregator ${ats}: ${companies.length} boards`)
    lists.push(companies)
  }
  return lists
}

// Downloads LastRound AI's ATS directory (CC BY 4.0), which names about 9,900 Greenhouse, Lever and Ashby boards.
async function lastroundCompanies(print: (line: string) => void): Promise<Company[]> {
  const { companies, skipped } = readLastRound(await fetchText(LASTROUND_URL, { label: "The LastRound directory" }))
  print(`lastround: ${companies.length} boards, ${skipped} rows on other job sites or with no slug`)
  return companies
}

// Builds the company list from Simplify's files, the aggregator's and LastRound's lists when asked, and data/companies.extra.json.
export async function runCompanies(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const lists = await simplifyCompanies(print)
  if (args.includes("--with-aggregator")) lists.push(...(await aggregatorCompanies(print)))
  if (args.includes("--with-lastround")) lists.push(await lastroundCompanies(print))
  const extra = await readCompanyFile(join(dataDir, "companies.extra.json"), { optional: true, source: "extra" })

  const companies = mergeCompanies(lists, extra)
  const file = join(dataDir, "companies.json")
  await writeJsonFile(file, companies)

  const perSite = AGGREGATOR_SITES.map((ats) => `${ats} ${companies.filter((company) => company.ats === ats).length}`)
  print(`${companies.length} boards (${perSite.join(", ")}), ${extra.length} from companies.extra.json. Saved to ${file}`)
}

// Tests that filtersFromQuery puts the page's filter chips on top of the saved filters, and names any value it cannot use.
import { describe, expect, test } from "vitest"
import { parseSettings } from "../settings"
import { filtersFromQuery } from "./queryFilters"

const SAVED = parseSettings({ workAuth: { status: "f1-opt" }, filters: { roles: ["data analyst"], myDegree: "master" } }).filters

// Returns the filters for the given query string.
function withQuery(query: string) {
  return filtersFromQuery(SAVED, new URLSearchParams(query))
}

describe("filtersFromQuery", () => {
  test("keeps the saved filters when the page chose nothing", () => {
    expect(withQuery("")).toEqual(SAVED)
  })

  test("takes each chip the page sends over the saved value", () => {
    const filters = withQuery("within=7&workplace=remote,hybrid&jobType=intern&level=intern,new-grad&maxYears=1&minPay=80000&degree=phd")

    expect(filters).toEqual({
      ...SAVED,
      postedWithinDays: 7,
      workplaces: ["remote", "hybrid"],
      jobTypes: ["intern"],
      levels: ["intern", "new-grad"],
      maxYearsRequired: 1,
      minYearlyPay: 80000,
      myDegree: "phd",
    })
  })

  test("clears a list or the degree when the page sends 'any'", () => {
    const filters = withQuery("workplace=any&degree=any")

    expect(filters.workplaces).toEqual([])
    expect(filters.myDegree).toBeUndefined()
  })

  test.each([
    ["within=0", "within must be a whole number of days above 0."],
    ["workplace=office", "workplace may only use remote, hybrid, onsite."],
    ["jobType=gig", "jobType may only use full-time, part-time, contract, intern, temporary."],
    ["level=boss", "level may only use intern, new-grad, entry, mid, senior, staff."],
    ["maxYears=-1", "maxYears must be a whole number of years, 0 or more."],
    ["minPay=lots", "minPay must be a whole number of dollars, 0 or more."],
    ["degree=mba", "degree must be any, associate, bachelor, master or phd."],
  ])("refuses %s, saying what it takes", (query, message) => {
    expect(() => withQuery(query)).toThrow(message)
  })
})

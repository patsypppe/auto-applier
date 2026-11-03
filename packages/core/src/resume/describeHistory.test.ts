// Tests that jobs and degrees become short readable lines for showing the user what a resume contained.
import { describe, expect, test } from "vitest"
import { describeHistory } from "./describeHistory"

describe("describeHistory", () => {
  test("describes a job with its title, company and dates", () => {
    const { jobs } = describeHistory(
      [{ company: "Old Co", title: "Dev", startDate: "2015", endDate: "2018", description: "" }],
      [],
    )

    expect(jobs).toEqual(["Dev at Old Co (2015 – 2018)"])
  })

  test("says Present for a job without an end date", () => {
    const { jobs } = describeHistory(
      [{ company: "Acme", title: "Engineer", startDate: "Jan 2022", description: "" }],
      [],
    )

    expect(jobs).toEqual(["Engineer at Acme (Jan 2022 – Present)"])
  })

  test("describes a degree with its field, school and dates", () => {
    const { degrees } = describeHistory(
      [],
      [{ school: "State U", degree: "BSc", field: "Computer Science", startDate: "2018", endDate: "2022" }],
    )

    expect(degrees).toEqual(["BSc in Computer Science, State U (2018 – 2022)"])
  })

  test("leaves out the field when a degree has none", () => {
    const { degrees } = describeHistory([], [{ school: "State U", degree: "BSc", startDate: "2018", endDate: "2022" }])

    expect(degrees).toEqual(["BSc, State U (2018 – 2022)"])
  })

  test("shows a single date once when the start and end are the same", () => {
    const { degrees } = describeHistory(
      [],
      [{ school: "Bootcamp", degree: "Certificate", startDate: "2023", endDate: "2023" }],
    )

    expect(degrees).toEqual(["Certificate, Bootcamp (2023)"])
  })

  test("keeps the order it was given and handles several entries", () => {
    const { jobs } = describeHistory(
      [
        { company: "A", title: "T1", startDate: "2020", description: "" },
        { company: "B", title: "T2", startDate: "2018", endDate: "2020", description: "" },
      ],
      [],
    )

    expect(jobs).toEqual(["T1 at A (2020 – Present)", "T2 at B (2018 – 2020)"])
  })

  test("returns empty lists when there is nothing", () => {
    expect(describeHistory([], [])).toEqual({ jobs: [], degrees: [] })
  })
})

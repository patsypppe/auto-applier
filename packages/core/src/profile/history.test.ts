// Tests that the current job and current education are picked from the lists in a profile.
import { describe, expect, test } from "vitest"
import { currentEducation, currentJob } from "./history"
import type { Education, WorkExperience } from "./types"

const job = (company: string, endDate?: string): WorkExperience => ({
  company,
  title: `Engineer at ${company}`,
  startDate: "2020",
  endDate,
  description: "",
})

const school = (name: string, endDate?: string): Education => ({
  school: name,
  degree: `Degree from ${name}`,
  startDate: "2016",
  endDate,
})

describe("currentJob", () => {
  test("returns nothing when there are no jobs", () => {
    expect(currentJob([])).toBeUndefined()
  })

  test("returns the first job when every job has ended, because resumes list the newest first", () => {
    expect(currentJob([job("Newest", "2024"), job("Older", "2020")])?.company).toBe("Newest")
  })

  test("prefers the first job that has no end date, since that is where the person works now", () => {
    expect(currentJob([job("Past", "2024"), job("Now"), job("Also open")])?.company).toBe("Now")
  })
})

describe("currentEducation", () => {
  test("returns nothing when there is no education", () => {
    expect(currentEducation([])).toBeUndefined()
  })

  test("returns the first entry when every entry has ended", () => {
    expect(currentEducation([school("Newest", "2022"), school("Older", "2018")])?.school).toBe("Newest")
  })

  test("prefers the first entry with no end date, since that is where the person studies now", () => {
    expect(currentEducation([school("Done", "2022"), school("Still studying")])?.school).toBe("Still studying")
  })
})

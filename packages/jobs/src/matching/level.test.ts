// Tests that levelFromTitle reads the seniority a job title states, and leaves titles that state none undecided.
import { describe, expect, test } from "vitest"
import { levelFromTitle } from "./level"

describe("levelFromTitle", () => {
  test.each([
    ["Software Engineer Intern", "intern"],
    ["Machine Learning Internship - Summer 2027", "intern"],
    ["Data Science Co-op", "intern"],
    ["Software Engineer, New Grad", "new-grad"],
    ["University Graduate - Data Analyst", "new-grad"],
    ["Early Career Software Engineer", "new-grad"],
    ["Junior Data Analyst", "entry"],
    ["Data Analyst I", "entry"],
    ["Entry-Level Business Analyst", "entry"],
    ["Software Engineer II", "mid"],
    ["Senior Data Scientist", "senior"],
    ["Sr. Machine Learning Engineer", "senior"],
    ["Data Scientist III", "senior"],
    ["Engineering Manager, Data", "senior"],
    ["Staff Software Engineer", "staff"],
    ["Principal Data Scientist", "staff"],
  ])("reads %s as %s", (title, level) => {
    expect(levelFromTitle(title)).toBe(level)
  })

  test.each([["Data Scientist"], ["Machine Learning Engineer"], ["Associate Product Manager"]])("leaves %s undecided", (title) => {
    expect(levelFromTitle(title)).toBeUndefined()
  })

  test("reads the most senior word when a title has two, as in 'Senior Manager'", () => {
    expect(levelFromTitle("Senior Staff Engineer")).toBe("staff")
  })
})

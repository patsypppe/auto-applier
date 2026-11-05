// Tests that findSkills finds known skills in job text by name or alias, and skips the everyday words that look like skills.
import { describe, expect, test } from "vitest"
import { findSkills } from "./skills"

describe("findSkills", () => {
  test("finds skills by name, ignoring case, as whole words", () => {
    expect(findSkills("Experience with python, sql and Tableau dashboards.")).toEqual(["Python", "SQL", "Tableau"])
  })

  test("finds a skill by any of its other names, once, in the order the text first names them", () => {
    expect(findSkills("Use sklearn, scikit-learn and k8s on Postgres.")).toEqual(["scikit-learn", "Kubernetes", "PostgreSQL"])
  })

  test("does not find Java inside JavaScript", () => {
    expect(findSkills("JavaScript and TypeScript")).toEqual(["JavaScript", "TypeScript"])
  })

  test("finds C++ and C# as their own skills", () => {
    expect(findSkills("Strong C++ or C# skills.")).toEqual(["C++", "C#"])
  })

  test.each([
    ["Python or R for statistics", ["Python", "R", "Statistics"]],
    ["Java, C, C++ and Go", ["Java", "C", "C++", "Go"]],
  ])("finds the one-letter and short languages in %s, next to other languages", (text, skills) => {
    expect(findSkills(text)).toEqual(skills)
  })

  test.each([["Our R&D team raised a Series C."], ["Go to market with our sales team."], ["Plan B is to ship in Q3."]])(
    "does not read %s as a language",
    (text) => {
      expect(findSkills(text)).toEqual([])
    },
  )

  test("finds Golang as Go even with no other language nearby", () => {
    expect(findSkills("Backend work in Golang.")).toEqual(["Go"])
  })

  test("needs a capital letter for Spark and Excel, so 'spark ideas' and 'excel at' do not count", () => {
    expect(findSkills("You excel at sparking ideas.")).toEqual([])
    expect(findSkills("Apache Spark and Excel models.")).toEqual(["Spark", "Excel"])
  })

  test("also finds the extra skills it is given, such as ones from the user's profile", () => {
    expect(findSkills("We use dbt and Looker.", ["dbt", "Snowflake"])).toEqual(["dbt", "Looker"])
  })
})

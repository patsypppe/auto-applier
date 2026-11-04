// Tests that formatSummary reports boards, jobs and failures per job site in a few readable lines.
import { describe, expect, test } from "vitest"
import type { BoardResult } from "./collectBoards"
import { formatSummary } from "./summary"

describe("formatSummary", () => {
  test("gives one line per job site, then the failures and the time taken", () => {
    const results: BoardResult[] = [
      { ats: "greenhouse", slug: "stripe", outcome: "fetched", jobs: 758 },
      { ats: "greenhouse", slug: "databricks", outcome: "cached", jobs: 927 },
      { ats: "lever", slug: "spotify", outcome: "fetched", jobs: 85 },
      { ats: "lever", slug: "plaid", outcome: "failed", jobs: 0, error: "Lever board 'plaid' returned 404." },
    ]

    expect(formatSummary(results, 12.34)).toBe(
      [
        "Greenhouse: 2 of 2 boards read (1 from cache), 1,685 jobs",
        "Lever: 1 of 2 boards read, 85 jobs",
        "Failed:",
        "  lever:plaid  Lever board 'plaid' returned 404.",
        "Took 12.3 s.",
      ].join("\n"),
    )
  })

  test("leaves out job sites that had no boards and the failure list when nothing failed", () => {
    const results: BoardResult[] = [{ ats: "ashby", slug: "ramp", outcome: "fetched", jobs: 1 }]

    expect(formatSummary(results, 0.5)).toBe("Ashby: 1 of 1 board read, 1 job\nTook 0.5 s.")
  })
})

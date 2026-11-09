// Tests that the "labelled" command prints each field's score and lists the misses only when asked.
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { runLabelled } from "./labelled"

const JOB = {
  key: "greenhouse:acme:1",
  ats: "greenhouse",
  slug: "acme",
  company: "Acme",
  id: "1",
  title: "Data Analyst",
  url: "https://boards.example/1",
  locations: ["Austin, TX"],
  country: "US",
  firstSeenAt: "2026-11-03T00:00:00Z",
  lastSeenAt: "2026-11-04T00:00:00Z",
  description: "5+ years of experience.",
}

// Runs the command on a one-job file with the given arguments and returns what it printed.
async function run(args: string[]): Promise<string[]> {
  const file = join(await mkdtemp(join(tmpdir(), "labelled-")), "labelled.json")
  await writeFile(file, JSON.stringify([{ job: JOB, labels: { restrictions: [], years: 2, degree: null, pay: null, abroad: false } }]))
  const lines: string[] = []
  await runLabelled(args, file, (line) => lines.push(line))
  return lines
}

describe("runLabelled", () => {
  test("prints each field's score and the wrong hides", async () => {
    const lines = await run([])

    expect(lines).toContain("years: 0 of 1 right")
    expect(lines).toContain("tags: 1 of 1 right")
    expect(lines).toContain("hide or show: 0 of 1 right (1 wrongly hidden, 0 wrongly shown)")
    expect(lines.join("\n")).not.toContain("read 5, label 2")
  })

  test("lists every miss with --misses", async () => {
    expect((await run(["--misses"])).join("\n")).toContain("Acme | Data Analyst: read 5, label 2")
  })
})

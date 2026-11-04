// Tests that mergeCopies turns copies of one posting in several cities into one job and leaves different postings alone.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import type { JobRecord } from "../types"
import { mergeCopies } from "./mergeCopies"

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/repeat-postings.json"), "utf8")) as JobRecord[]
const [spacexRedmond, spacexBastrop, tsmgRouen, tsmgBordeaux, deepgramUs, deepgramSingapore] = FIXTURE

describe("mergeCopies", () => {
  test("joins copies into one job with every location", () => {
    const [merged, ...rest] = mergeCopies([tsmgRouen!, tsmgBordeaux!])

    expect(rest).toEqual([])
    expect(merged!.locations).toEqual(["Rouen", "Bordeaux"])
    expect(merged!.title).toBe("Surveyor/Field Data Analyst")
  })

  test("keys the joined job by the copy with the lowest id, whatever order they came in", () => {
    const ids = [tsmgRouen!.id, tsmgBordeaux!.id].sort()

    expect(mergeCopies([tsmgRouen!, tsmgBordeaux!])[0]!.id).toBe(ids[0])
    expect(mergeCopies([tsmgBordeaux!, tsmgRouen!])[0]!.id).toBe(ids[0])
  })

  test("compares numeric ids as numbers", () => {
    const small = { ...tsmgRouen!, id: "999", key: "greenhouse:tsmg:999" }
    const large = { ...tsmgBordeaux!, id: "1000", key: "greenhouse:tsmg:1000" }

    expect(mergeCopies([large, small])[0]!.key).toBe("greenhouse:tsmg:999")
  })

  test("leaves postings whose text really differs as separate jobs", () => {
    const jobs = mergeCopies([spacexRedmond!, spacexBastrop!, deepgramUs!, deepgramSingapore!])

    expect(jobs.map((job) => job.locations)).toEqual([["Redmond, WA"], ["Bastrop, TX"], ["USA - Remote"], ["Singapore"]])
  })

  test("counts a joined job as US when any copy is in the US", () => {
    const abroad = { ...tsmgRouen!, country: "other" as const }
    const home = { ...tsmgBordeaux!, country: "US" as const }

    expect(mergeCopies([abroad, home])[0]!.country).toBe("US")
  })

  test("takes the earliest posting date and the latest update", () => {
    const older = { ...tsmgRouen!, postedAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z" }
    const newer = { ...tsmgBordeaux!, postedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z" }

    const [merged] = mergeCopies([newer, older])

    expect([merged!.postedAt, merged!.updatedAt]).toEqual(["2026-09-01T00:00:00Z", "2026-10-05T00:00:00Z"])
  })

  test("keeps jobs in the order their first copy appeared and stores the hash", () => {
    const jobs = mergeCopies([deepgramUs!, tsmgRouen!, deepgramSingapore!, tsmgBordeaux!])

    expect(jobs.map((job) => job.slug)).toEqual(["deepgram", "tsmg", "deepgram"])
    expect(jobs.every((job) => typeof job.textHash === "string" && job.textHash.length === 64)).toBe(true)
  })
})

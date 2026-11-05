// Tests tagJob on the 60 real postings hand-checked in RESEARCH.md, with the two corrections from the later review.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import type { AuthTag } from "../types"
import { tagJob } from "./tagJob"

type Posting = {
  n: number
  company: string
  title: string
  country?: "US" | "other"
  description: string
  expect: { has: AuthTag[]; hasNot: AuthTag[] }
}

const POSTINGS = JSON.parse(readFileSync(join(import.meta.dirname, "../../test/fixtures/work-auth-postings.json"), "utf8")) as Posting[]

describe("tagJob on the hand-checked postings", () => {
  test.each(POSTINGS.map((posting) => [posting.n, posting.company, posting] as const))("#%i %s", (_n, _company, posting) => {
    const tags = tagJob(posting).map((found) => found.tag)

    for (const tag of posting.expect.has) expect(tags).toContain(tag)
    for (const tag of posting.expect.hasNot) expect(tags).not.toContain(tag)
  })
})

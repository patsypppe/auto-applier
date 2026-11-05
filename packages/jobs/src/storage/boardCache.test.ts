// Tests that the board cache returns a saved answer while it is fresh and nothing once it is old, missing or broken.
import { mkdtemp, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "vitest"
import { readCachedBoard, writeCachedBoard } from "./boardCache"

const SAVED_AT = new Date("2026-11-04T08:00:00Z")
const hoursLater = (hours: number) => new Date(SAVED_AT.getTime() + hours * 3_600_000)

let dir = ""

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "board-cache-"))
})

describe("board cache", () => {
  test("returns the saved answer while it is younger than the limit", async () => {
    await writeCachedBoard(dir, "greenhouse", "stripe", { jobs: [1, 2] }, SAVED_AT)

    expect(await readCachedBoard(dir, "greenhouse", "stripe", 12, hoursLater(11))).toEqual({ jobs: [1, 2] })
  })

  test("returns nothing once the answer is older than the limit", async () => {
    await writeCachedBoard(dir, "greenhouse", "stripe", { jobs: [] }, SAVED_AT)

    expect(await readCachedBoard(dir, "greenhouse", "stripe", 12, hoursLater(13))).toBeUndefined()
  })

  test("returns nothing with a limit of zero, which is how --fresh skips it", async () => {
    await writeCachedBoard(dir, "greenhouse", "stripe", { jobs: [] }, SAVED_AT)

    expect(await readCachedBoard(dir, "greenhouse", "stripe", 0, SAVED_AT)).toBeUndefined()
  })

  test("returns nothing for a board that was never saved", async () => {
    expect(await readCachedBoard(dir, "lever", "nobody", 12, SAVED_AT)).toBeUndefined()
  })

  test("treats a broken file as not saved", async () => {
    await writeCachedBoard(dir, "ashby", "ramp", { jobs: [] }, SAVED_AT)
    const [file] = await readdir(join(dir, "ashby"))
    await writeFile(join(dir, "ashby", file!), "{ not json")

    expect(await readCachedBoard(dir, "ashby", "ramp", 12, SAVED_AT)).toBeUndefined()
  })

  test("keeps boards of different job sites apart", async () => {
    await writeCachedBoard(dir, "greenhouse", "acme", { from: "greenhouse" }, SAVED_AT)
    await writeCachedBoard(dir, "lever", "acme", { from: "lever" }, SAVED_AT)

    expect(await readCachedBoard(dir, "lever", "acme", 12, SAVED_AT)).toEqual({ from: "lever" })
  })

  test("stores a slug with a slash inside the job site's folder", async () => {
    await writeCachedBoard(dir, "greenhouse", "../escape", { jobs: [] }, SAVED_AT)

    expect(await readdir(dir)).toEqual(["greenhouse"])
    expect(await readCachedBoard(dir, "greenhouse", "../escape", 12, SAVED_AT)).toEqual({ jobs: [] })
  })
})

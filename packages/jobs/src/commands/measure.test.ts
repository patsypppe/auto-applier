// Tests the measure command's parts: the median, the runs, the lines it prints, its options, reading the page's token, and
// putting settings.json back as it was. The runs here are fakes; only the real command starts the feed.
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { median, measureRuns, runMeasure, runsFrom, summaryLines, tokenFrom, type RunResult } from "./measure"

const RESULTS: RunResult[] = [
  { startSeconds: 131.2, saveSeconds: 0.61, peakMb: 330 },
  { startSeconds: 231.4, saveSeconds: 0.64, peakMb: 547 },
  { startSeconds: 135.0, saveSeconds: 0.62, peakMb: 304 },
]

describe("median", () => {
  test("takes the middle value, or the mean of the two middle ones", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe("runsFrom", () => {
  test("reads --runs, five by default, and refuses anything but a whole number from 1 to 20", () => {
    expect(runsFrom([])).toBe(5)
    expect(runsFrom(["--runs", "3"])).toBe(3)
    expect(() => runsFrom(["--runs", "0"])).toThrow("--runs must be a whole number from 1 to 20")
    expect(() => runsFrom(["--runs", "two"])).toThrow("--runs must be a whole number from 1 to 20")
  })
})

describe("tokenFrom", () => {
  test("reads the session token the server wrote into the page, and says so when there is none", () => {
    expect(tokenFrom('<meta name="feed-token" content="abc123">')).toBe("abc123")
    expect(() => tokenFrom("<html></html>")).toThrow("The feed page had no session token.")
  })
})

describe("measureRuns", () => {
  test("runs one after another and keeps each result in order", async () => {
    const started: number[] = []
    const results = await measureRuns(3, async (run) => {
      started.push(run)
      return RESULTS[run - 1]!
    })

    expect(started).toEqual([1, 2, 3])
    expect(results).toEqual(RESULTS)
  })

  test("names the run that failed", async () => {
    await expect(measureRuns(3, async (run) => (run === 2 ? Promise.reject(new Error("the feed stopped")) : RESULTS[0]!))).rejects.toThrow("Run 2 failed: the feed stopped")
  })
})

describe("summaryLines", () => {
  test("prints each run and then the medians", () => {
    expect(summaryLines(RESULTS)).toEqual([
      "Run 1: started in 131.2 s, saved settings in 0.61 s, peak memory 330 MB",
      "Run 2: started in 231.4 s, saved settings in 0.64 s, peak memory 547 MB",
      "Run 3: started in 135.0 s, saved settings in 0.62 s, peak memory 304 MB",
      "Median of 3 runs: started in 135.0 s, saved settings in 0.62 s, peak memory 330 MB",
    ])
  })
})

describe("runMeasure", () => {
  test("prints the summary and puts settings.json back exactly as it was, even after a failed run", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "measure-"))
    const original = '{ "workAuth": { "status": "f1-opt" }, "filters": { "roles": ["data analyst"] } }\n'
    await writeFile(join(dataDir, "settings.json"), original)
    const lines: string[] = []

    await runMeasure(["--runs", "2"], dataDir, (line) => lines.push(line), async (run) => {
      await writeFile(join(dataDir, "settings.json"), `{"rewritten": ${run}}`)
      return RESULTS[run - 1]!
    })
    expect(lines.at(-1)).toBe("Median of 2 runs: started in 181.3 s, saved settings in 0.63 s, peak memory 439 MB")
    expect(await readFile(join(dataDir, "settings.json"), "utf8")).toBe(original)

    await expect(runMeasure(["--runs", "1"], dataDir, () => undefined, async () => {
      await writeFile(join(dataDir, "settings.json"), "{}")
      throw new Error("no answer")
    })).rejects.toThrow("Run 1 failed: no answer")
    expect(await readFile(join(dataDir, "settings.json"), "utf8")).toBe(original)
  })

  test("needs saved settings, since it times a settings save", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "measure-"))

    await expect(runMeasure([], dataDir, () => undefined, async () => RESULTS[0]!)).rejects.toThrow("measure needs data/settings.json")
  })
})

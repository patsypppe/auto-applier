// The "measure" command: starts the feed several times, each in its own process, saves the settings once in each, and
// prints the start time, save time and peak memory of every run and their medians. settings.json is put back as it was.
import { spawn, type ChildProcess } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"

export type RunResult = { startSeconds: number; saveSeconds: number; peakMb: number }

const DEFAULT_RUNS = 5
const PORT = 4318

// Loaded into each feed process before it starts: when stopped, it prints the most memory the process held, in kilobytes.
const PEAK_REPORTER = `process.on("SIGTERM", () => { process.stdout.write("peak-rss-kb " + process.resourceUsage().maxRSS + "\\n"); process.exit(0) })`

// Returns the middle value, or the mean of the two middle ones for an even count.
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

// Reads --runs from the arguments, or the default of five.
export function runsFrom(args: readonly string[]): number {
  const index = args.indexOf("--runs")
  const runs = index === -1 ? DEFAULT_RUNS : Number(args[index + 1])
  if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error("--runs must be a whole number from 1 to 20, for example --runs 5.")
  return runs
}

// Reads the session token the server writes into the feed page, which a settings save must carry.
export function tokenFrom(html: string): string {
  const token = html.match(/<meta name="feed-token" content="([^"]+)">/)?.[1]
  if (!token) throw new Error("The feed page had no session token.")
  return token
}

// Runs the measurement the given number of times, one after another, and names the run that failed.
export async function measureRuns(runs: number, runOnce: (run: number) => Promise<RunResult>): Promise<RunResult[]> {
  const results: RunResult[] = []
  for (let run = 1; run <= runs; run++) {
    try {
      results.push(await runOnce(run))
    } catch (error: unknown) {
      throw new Error(`Run ${run} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return results
}

// Writes one result as a sentence.
function describe(result: RunResult): string {
  return `started in ${result.startSeconds.toFixed(1)} s, saved settings in ${result.saveSeconds.toFixed(2)} s, peak memory ${Math.round(result.peakMb)} MB`
}

// Returns a line per run and then a line of medians.
export function summaryLines(results: readonly RunResult[]): string[] {
  const middle: RunResult = {
    startSeconds: median(results.map((result) => result.startSeconds)),
    saveSeconds: median(results.map((result) => result.saveSeconds)),
    peakMb: median(results.map((result) => result.peakMb)),
  }
  return [...results.map((result, index) => `Run ${index + 1}: ${describe(result)}`), `Median of ${results.length} runs: ${describe(middle)}`]
}

// Watches a process's output and returns a function that waits for a line that passes a test, failing with what the
// process wrote to stderr when it ends first.
function lineWatcher(child: ChildProcess): (wanted: (line: string) => boolean) => Promise<string> {
  const seen: string[] = []
  const waiting: { wanted: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void }[] = []
  let errors = ""
  let ended = false
  const ending = () => new Error(`the feed stopped before it was ready. ${errors.trim()}`.trim())

  child.stderr?.on("data", (chunk: Buffer) => (errors += chunk.toString()))
  createInterface({ input: child.stdout! }).on("line", (line) => {
    seen.push(line)
    for (const waiter of waiting.filter((item) => item.wanted(line))) {
      waiting.splice(waiting.indexOf(waiter), 1)
      waiter.resolve(line)
    }
  })
  child.on("close", () => {
    ended = true
    for (const waiter of waiting.splice(0)) waiter.reject(ending())
  })

  return (wanted) =>
    new Promise((resolve, reject) => {
      const found = seen.find(wanted)
      if (found !== undefined) return resolve(found)
      if (ended) return reject(ending())
      waiting.push({ wanted, resolve, reject })
    })
}

// Returns one real run: start the feed in its own process and time it until it says where it is, fetch the page's token
// and the saved settings, time sending them back unchanged, then stop the process and read its peak memory.
function feedRun(cliFile: string): (run: number) => Promise<RunResult> {
  return async () => {
    const began = performance.now()
    const child = spawn(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(PEAK_REPORTER)}`, cliFile, "feed", "--port", String(PORT)], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    const waitFor = lineWatcher(child)
    try {
      await waitFor((line) => line.startsWith("The feed is at"))
      const startSeconds = (performance.now() - began) / 1000

      const base = `http://127.0.0.1:${PORT}`
      const token = tokenFrom(await (await fetch(`${base}/`)).text())
      const { settings } = (await (await fetch(`${base}/api/settings`)).json()) as { settings: unknown }
      const saveBegan = performance.now()
      const saved = await fetch(`${base}/api/settings`, { method: "POST", headers: { "Content-Type": "application/json", "X-Feed-Token": token }, body: JSON.stringify(settings) })
      await saved.arrayBuffer()
      if (!saved.ok) throw new Error(`the settings save answered HTTP ${saved.status}.`)
      const saveSeconds = (performance.now() - saveBegan) / 1000

      child.kill("SIGTERM")
      const peak = await waitFor((line) => line.startsWith("peak-rss-kb "))
      return { startSeconds, saveSeconds, peakMb: Number(peak.split(" ")[1]) / 1024 }
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    }
  }
}

// Measures the feed and prints every run and the medians. settings.json is read first and written back afterwards, even
// when a run fails, since each run saves the settings and the server writes them with its defaults filled in.
export async function runMeasure(
  args: readonly string[],
  dataDir: string,
  print: (line: string) => void,
  runOnce: (run: number) => Promise<RunResult> = feedRun(fileURLToPath(new URL("./cli.js", import.meta.url))),
): Promise<void> {
  const runs = runsFrom(args)
  const settingsFile = join(dataDir, "settings.json")
  const original = await readFile(settingsFile, "utf8").catch(() => undefined)
  if (original === undefined) throw new Error("measure needs data/settings.json, since it times a settings save. Save the settings on the feed page first.")

  print(`Measuring ${runs} runs of the feed on port ${PORT}, one after another. Each start reads every job, so this takes a while.`)
  try {
    const results = await measureRuns(runs, async (run) => {
      const result = await runOnce(run)
      print(`Run ${run}: ${describe(result)}`)
      return result
    })
    print(summaryLines(results).at(-1)!)
  } finally {
    await writeFile(settingsFile, original)
  }
}

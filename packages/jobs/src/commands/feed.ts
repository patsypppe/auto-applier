// The "feed" command: ranks the collected jobs once, then serves the feed page on this computer until stopped.
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { getJobs } from "../feed/getJobs"
import { loadHistory } from "../history/loadHistory"
import { loadProfile } from "../profile"
import { serveFeed } from "../server/serveFeed"
import { loadSettings } from "../settings"
import { readJobsFile } from "../storage/files"

const DEFAULT_PORT = 4317

// Reads --port from the arguments, or the default.
function portFrom(args: readonly string[]): number {
  const index = args.indexOf("--port")
  const port = index === -1 ? DEFAULT_PORT : Number(args[index + 1])
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("--port must be a number from 1 to 65535, for example --port 4317.")
  return port
}

// Loads everything, ranks the jobs and starts the page server. The page files sit next to the built command in dist/.
export async function runFeed(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const settings = await loadSettings(join(dataDir, "settings.json"))
  const profile = await loadProfile(join(dataDir, "profile.json"))
  const jobs = await readJobsFile(join(dataDir, "jobs.jsonl"))

  print(`Ranking ${jobs.length.toLocaleString("en-US")} jobs. This takes about a minute for the full list.`)
  const ranked = getJobs(settings, profile, jobs, await loadHistory(dataDir))
  const pageDir = fileURLToPath(new URL(".", import.meta.url))
  const { url } = await serveFeed({ ranked, settings, dataDir, pageDir, port: portFrom(args) })
  print(`The feed is at ${url} (only on this computer). Press Ctrl+C to stop.`)
}

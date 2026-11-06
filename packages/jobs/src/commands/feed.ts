// The "feed" command: reads the collected jobs once, then serves the feed page on this computer until stopped. Settings
// saved on the page rank the jobs again without reading them again.
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { prepareJobs } from "../feed/getJobs"
import { loadHistory } from "../history/loadHistory"
import { loadProfile } from "../profile"
import { serveFeed } from "../server/serveFeed"
import { loadSettingsIfAny } from "../settings"
import { readJobsFile } from "../storage/files"

const DEFAULT_PORT = 4317

// Reads --port from the arguments, or the default.
function portFrom(args: readonly string[]): number {
  const index = args.indexOf("--port")
  const port = index === -1 ? DEFAULT_PORT : Number(args[index + 1])
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("--port must be a number from 1 to 65535, for example --port 4317.")
  return port
}

// Loads everything, reads the jobs and starts the page server. The page files sit next to the built command in dist/.
// With no settings.json yet, the page opens its settings panel and the jobs are ranked once they are saved.
export async function runFeed(args: readonly string[], dataDir: string, print: (line: string) => void): Promise<void> {
  const settings = await loadSettingsIfAny(join(dataDir, "settings.json"))
  const profile = await loadProfile(join(dataDir, "profile.json"))
  const jobs = await readJobsFile(join(dataDir, "jobs.jsonl"))

  print(`Reading ${jobs.length.toLocaleString("en-US")} jobs. This takes about two minutes for the full list.`)
  const prepared = prepareJobs(profile, jobs, await loadHistory(dataDir))
  const pageDir = fileURLToPath(new URL(".", import.meta.url))
  const { url } = await serveFeed({ prepared, settings, dataDir, pageDir, port: portFrom(args) })
  if (!settings) print("There is no data/settings.json yet. Fill in the settings on the page.")
  print(`The feed is at ${url} (only on this computer). Press Ctrl+C to stop.`)
}

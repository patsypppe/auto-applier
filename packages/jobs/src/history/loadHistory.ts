// Loads the H-1B history that the h1b command saved, with the hand-kept aliases, or nothing when it has not been built.
import { join } from "node:path"
import type { HistoryInput } from "../feed/getJobs"
import { readJsonFile } from "../storage/files"
import type { H1bHistory } from "./readH1bCsv"

// Returns the saved history and aliases from the data folder, or undefined when data/h1b.json does not exist yet.
export async function loadHistory(dataDir: string): Promise<HistoryInput | undefined> {
  const data = await readJsonFile<H1bHistory | undefined>(join(dataDir, "h1b.json"), undefined)
  if (!data) return undefined
  return { data, aliases: await readJsonFile<Record<string, string>>(join(dataDir, "aliases.json"), {}) }
}

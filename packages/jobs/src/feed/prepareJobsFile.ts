// Prepares the jobs in data/jobs.jsonl one at a time as the file is read, so the whole file is never in memory at once.
import type { Profile } from "@auto-applier/core"
import { eachJob } from "../storage/files"
import { jobPreparer, type HistoryInput, type PreparedJob } from "./getJobs"

// Reads the jobs file line by line and prepares each job, in file order; a missing file gives no jobs.
export async function prepareJobsFile(file: string, profile: Profile, history?: HistoryInput): Promise<PreparedJob[]> {
  const prepare = jobPreparer(profile, history)
  const prepared: PreparedJob[] = []
  await eachJob(file, (job) => prepared.push(prepare(job)))
  return prepared
}

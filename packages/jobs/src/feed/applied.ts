// Keeps the user's application history: each job's current status, every change with its date, and an optional note.
export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected"

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"]

export type AppliedEntry = {
  key: string
  company: string
  title: string
  url: string
  status: ApplicationStatus
  changes: { status: ApplicationStatus; date: string }[]
  note?: string
}

type JobInfo = Pick<AppliedEntry, "key" | "company" | "title" | "url">

// Returns the history with the job's status set, a change recorded when the status is new, and "none" removing the job.
// The job's title, company and link are kept so the history still reads well after the posting is taken down.
export function setStatus(
  history: readonly AppliedEntry[],
  job: JobInfo,
  status: ApplicationStatus | "none",
  now: Date,
  note?: string,
): AppliedEntry[] {
  if (status === "none") return history.filter((entry) => entry.key !== job.key)

  const existing = history.find((entry) => entry.key === job.key)
  const changes = existing?.status === status ? existing.changes : [...(existing?.changes ?? []), { status, date: now.toISOString() }]
  const kept = note ?? existing?.note
  const entry: AppliedEntry = { ...(existing ?? job), status, changes, ...(kept === undefined ? {} : { note: kept }) }

  return existing ? history.map((item) => (item.key === job.key ? entry : item)) : [...history, entry]
}

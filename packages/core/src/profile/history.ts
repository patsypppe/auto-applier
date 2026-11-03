// Picks the current job and current education from a profile's lists, so forms asking for them can be filled.
import type { Education, WorkExperience } from "./types"

// Returns the first entry with no end date (still going), or else the first entry, since resumes list the newest first.
function currentEntry<T extends { endDate?: string }>(entries: readonly T[]): T | undefined {
  return entries.find((entry) => !entry.endDate) ?? entries[0]
}

// Returns the job the person holds now, or their most recent one.
export function currentJob(experience: readonly WorkExperience[]): WorkExperience | undefined {
  return currentEntry(experience)
}

// Returns the education the person is in now, or their most recent one.
export function currentEducation(education: readonly Education[]): Education | undefined {
  return currentEntry(education)
}

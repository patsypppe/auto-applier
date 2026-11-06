// Remembers when the user opened the feed, so the page can mark the jobs first seen since the visit before.
export type Visits = { current: string; previous?: string }

const SAME_VISIT_MS = 30 * 60 * 1000

// Returns the visits after opening the page now: a reload within half an hour is the same visit, and a later opening
// makes the current visit the previous one.
export function nextVisits(stored: Visits | undefined, now: string): Visits {
  if (!stored) return { current: now }
  if (Date.parse(now) - Date.parse(stored.current) < SAME_VISIT_MS) return stored
  return { current: now, previous: stored.current }
}

// Public entry point of the jobs package: what the extension or another package may call.
export { getJobs, type RankedJob } from "./feed/getJobs"
export { applyFilters, type Filtered, type HideReason } from "./feed/applyFilters"
export { parseSettings, type FeedSettings, type Filters } from "./settings"
export type { AuthTag, Effect, JobRecord, Level, Tag, WorkAuth, WorkAuthStatus } from "./types"

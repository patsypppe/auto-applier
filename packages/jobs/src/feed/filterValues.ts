// The values the level, workplace and job-type filters take, kept apart from settings.ts so the page can use them too.
import type { JobType, Level, Workplace } from "../types"

export const LEVELS: readonly Level[] = ["intern", "new-grad", "entry", "mid", "senior", "staff"]
export const WORKPLACES: readonly Workplace[] = ["remote", "hybrid", "onsite"]
export const JOB_TYPES: readonly JobType[] = ["full-time", "part-time", "contract", "intern", "temporary"]

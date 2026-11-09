// Scores how well a job fits the user: 70 points for the share of the job's named skills the user has (counting at least
// three), and 30 for a wanted title.
import type { Degree, Level } from "../types"
import { degreeRequired } from "./degree"
import { yearsRequired, yearsWithMaster } from "./experience"
import { levelFromTitle } from "./level"
import { findSkills } from "./skills"

const MIN_SKILLS_COUNTED = 3

export type MatchReasons = {
  matchedSkills: string[]
  missingSkills: string[]
  titleMatches: boolean
  level?: Level
  yearsRequired?: number
  yearsWithMaster?: number
  degreeRequired?: Degree
}

export type Match = { score: number; reasons: MatchReasons }

export type JobReads = Omit<MatchReasons, "titleMatches">

// Returns a check for whether a title holds one of the wanted roles as whole words, ignoring case, with the patterns
// built once so a whole feed can be checked quickly.
export function roleMatcher(roles: readonly string[]): (title: string) => boolean {
  const patterns = roles.map((role) => new RegExp(`(?<![a-z])${role.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`))
  return (title) => {
    const lower = title.toLowerCase()
    return patterns.some((pattern) => pattern.test(lower))
  }
}

// Returns true when the title holds one of the wanted roles as whole words, ignoring case.
export function titleHasRole(title: string, roles: readonly string[]): boolean {
  return roleMatcher(roles)(title)
}

// Reads what does not change with the wanted roles: the skills the job names that the user has and lacks, the level,
// and the years and degree it requires. This is the slow part, so the feed keeps it and only scores again.
export function readMatch(job: { title: string; description: string }, skills: readonly string[]): JobReads {
  const mine = new Set(skills.map((skill) => skill.toLowerCase()))
  const text = `${job.title}\n${job.description}`
  const named = findSkills(text, skills)
  return {
    matchedSkills: named.filter((skill) => mine.has(skill.toLowerCase())),
    missingSkills: named.filter((skill) => !mine.has(skill.toLowerCase())),
    level: levelFromTitle(job.title),
    yearsRequired: yearsRequired(text),
    yearsWithMaster: yearsWithMaster(text),
    degreeRequired: degreeRequired(job.description, job.title),
  }
}

// Scores reads made by readMatch, given whether the title holds a wanted role.
export function scoreReads(reads: JobReads, titleMatches: boolean): Match {
  const named = reads.matchedSkills.length + reads.missingSkills.length
  // At least three skills count in the share, so a posting that names one skill the user has cannot score full marks.
  const skillPart = (70 * reads.matchedSkills.length) / Math.max(named, MIN_SKILLS_COUNTED)
  const { matchedSkills, missingSkills, ...rest } = reads
  return { score: Math.round(skillPart + (titleMatches ? 30 : 0)), reasons: { matchedSkills, missingSkills, titleMatches, ...rest } }
}

// Scores the job and lists the reasons: the skills it names that the user has and lacks, the title, the level, and the
// years and degree it requires.
export function scoreMatch(job: { title: string; description: string }, me: { skills: readonly string[]; roles: readonly string[] }): Match {
  return scoreReads(readMatch(job, me.skills), titleHasRole(job.title, me.roles))
}

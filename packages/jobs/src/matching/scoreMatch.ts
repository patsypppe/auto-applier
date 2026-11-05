// Scores how well a job fits the user: 70 points for the share of the job's named skills the user has (counting at least
// three), and 30 for a wanted title.
import type { Level } from "../types"
import { yearsRequired } from "./experience"
import { levelFromTitle } from "./level"
import { findSkills } from "./skills"

const MIN_SKILLS_COUNTED = 3

export type MatchReasons = {
  matchedSkills: string[]
  missingSkills: string[]
  titleMatches: boolean
  level?: Level
  yearsRequired?: number
}

export type Match = { score: number; reasons: MatchReasons }

// Returns true when the title holds one of the wanted roles as whole words, ignoring case.
function titleHasRole(title: string, roles: readonly string[]): boolean {
  const lower = title.toLowerCase()
  return roles.some((role) => new RegExp(`(?<![a-z])${role.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`).test(lower))
}

// Scores the job and lists the reasons: the skills it names that the user has and lacks, the title, and the level.
export function scoreMatch(job: { title: string; description: string }, me: { skills: readonly string[]; roles: readonly string[] }): Match {
  const mine = new Set(me.skills.map((skill) => skill.toLowerCase()))
  const text = `${job.title}\n${job.description}`
  const named = findSkills(text, me.skills)
  const matchedSkills = named.filter((skill) => mine.has(skill.toLowerCase()))
  const missingSkills = named.filter((skill) => !mine.has(skill.toLowerCase()))
  const titleMatches = titleHasRole(job.title, me.roles)

  // At least three skills count in the share, so a posting that names one skill the user has cannot score full marks.
  const skillPart = (70 * matchedSkills.length) / Math.max(named.length, MIN_SKILLS_COUNTED)
  return {
    score: Math.round(skillPart + (titleMatches ? 30 : 0)),
    reasons: { matchedSkills, missingSkills, titleMatches, level: levelFromTitle(job.title), yearsRequired: yearsRequired(text) },
  }
}

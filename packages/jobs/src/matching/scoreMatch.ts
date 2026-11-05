// Scores how well a job fits the user: 70 points for the share of the job's named skills the user has, 30 for a wanted title.
import type { Level } from "../types"
import { levelFromTitle } from "./level"
import { findSkills } from "./skills"

export type MatchReasons = {
  matchedSkills: string[]
  missingSkills: string[]
  titleMatches: boolean
  level?: Level
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
  const named = findSkills(`${job.title}\n${job.description}`, me.skills)
  const matchedSkills = named.filter((skill) => mine.has(skill.toLowerCase()))
  const missingSkills = named.filter((skill) => !mine.has(skill.toLowerCase()))
  const titleMatches = titleHasRole(job.title, me.roles)

  const skillPart = named.length === 0 ? 0 : (70 * matchedSkills.length) / named.length
  return {
    score: Math.round(skillPart + (titleMatches ? 30 : 0)),
    reasons: { matchedSkills, missingSkills, titleMatches, level: levelFromTitle(job.title) },
  }
}

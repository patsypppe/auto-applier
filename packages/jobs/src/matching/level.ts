// Reads the seniority a job title states, checking the most senior words first so "Senior Staff Engineer" is staff.
import type { Level } from "../types"

// The Roman numerals have no "i" flag, so a lowercase "i" in a title is never read as level I.
const RULES: readonly [Level, RegExp][] = [
  ["staff", /\b(staff|principal|distinguished|fellow)\b/i],
  ["senior", /\b(senior|sr\.?|lead|director|head of|vp|vice president|(engineering|data science|analytics) manager)\b/i],
  ["senior", /\b(III|IV)\b/],
  ["mid", /\bII\b/],
  ["intern", /\b(intern|internship|co-?op)\b/i],
  ["new-grad", /\b(new grad(uate)?|university grad(uate)?|recent grad(uate)?|early career|campus)\b/i],
  ["entry", /\b(junior|jr\.?|entry[- ]level)\b/i],
  ["entry", /\bI\b(?!\w)/],
]

// Returns the level the title states, or undefined when it states none, as in a plain "Data Scientist".
export function levelFromTitle(title: string): Level | undefined {
  return RULES.find(([, pattern]) => pattern.test(title))?.[0]
}

// Reads how many years of experience a posting asks for, from phrases like "3+ years of experience" or "3-5 years in a role",
// both in general and for someone with a master's degree, which some postings accept in place of years.
import { splitSentences } from "../tags/sentences"
import { WISH_WORDS } from "./wishWords"

// "3+ years", "3-5 years", "3 to 5 years", "at least 3 years", "a minimum of 3 years", "3 or more years", then within a few
// words something that shows the years are experience, not the company's age or the applicant's.
const YEARS = /\b(at least|a minimum of|minimum of|minimum)?\s*(\d{1,2})\s*(\+|or more|(?:-|–|to)\s*\d{1,2})?\s*(\+)?\s*years?'?\b/gi
const ABOUT_EXPERIENCE = /^[^.;]{0,40}?\b(experience|role|industry|working|work|professional|in (a|an|the) )/i
// "3+ years" or "at least 3 years" is always a requirement, so it may be followed by "of", "in" or a verb like "building".
const FIRM_FOLLOWED_BY = /^\s*(of|in|\w+ing|\w+ed)\b/i
const NOT_EXPERIENCE = /^\s*(of age|old|ago)\b/i
const ONLY_PREFERRED = new RegExp(String.raw`\b(${WISH_WORDS})\b`, "i")
// "Nice to have: Python, 3+ years with Spark": a wish heading covers the whole list after it.
const WISH_HEADING = new RegExp(String.raw`\b(${WISH_WORDS})\b[^,;]*:`, "i")
// "5+ years of Python preferred": the wish comes after the years, before the next comma.
const PREFERRED_AFTER = /^[^.;,]{0,60}\b(preferred|nice to have|a plus|bonus|desired)\b/i
// "Required Experience: 8 years": the label before the years says what they are.
const EXPERIENCE_LABEL = /\bexperience\s*:\s*$/i

const MASTER = String.raw`(?:[Mm]aster(?:['’]?s)?(?!\s+[Dd]ata)|\bM\.?S\.?\b(?!\s+(?:SQL|Office|Excel)))`
const MASTER_TIER_AFTER = new RegExp(String.raw`${MASTER}[^.;,]{0,40}?\b(\d{1,2})\s*\+?\s*years?\b`)
const MASTER_TIER_BEFORE = new RegExp(String.raw`\b(\d{1,2})\s*\+?\s*years?\b[^.;,]{0,40}?${MASTER}`)
// Years offered as one way in, next to a degree a master's holder already has: "..., or a master's degree",
// "Bachelor's degree or 3+ years", "OR a bachelor's in a STEM field", "OR High school diploma ... with 4+ years".
const DEGREE_INSTEAD = /\bor\s+(?:a\s+|an\s+)?(?:master|M\.?S\b)|\b(?:bachelor\S*|degree)\b[^.;]{0,40}\bor\s+\d{1,2}\+?\s*years?\b|\byears?\b[^.]{0,100}\bor\s+(?:a\s+)?bachelor|\bor\s+high school\b/i

// Returns the years each matching phrase in one sentence requires, leaving out years the sentence only prefers. A wish
// word counts only in the clause of the years, or as a heading over a list.
function yearsIn(sentence: string): number[] {
  const found: number[] = []
  for (const match of sentence.matchAll(YEARS)) {
    const before = sentence.slice(0, match.index ?? 0)
    const after = sentence.slice((match.index ?? 0) + match[0].length)
    const firm = Boolean(match[1] || match[3] || match[4])
    const clause = before.split(/[,;]/).pop() ?? ""
    if (ONLY_PREFERRED.test(clause) || WISH_HEADING.test(before) || PREFERRED_AFTER.test(after) || NOT_EXPERIENCE.test(after)) continue
    if (ABOUT_EXPERIENCE.test(after) || EXPERIENCE_LABEL.test(before) || (firm && FIRM_FOLLOWED_BY.test(after))) found.push(Number(match[2]))
  }
  return found
}

// Returns the years a sentence asks of someone with a master's: the years stated for a master's when it lists them by
// degree, none when a degree stands in for the years, otherwise the same as anyone.
function yearsWithMasterIn(sentence: string): number[] {
  const tier = sentence.match(MASTER_TIER_AFTER) ?? sentence.match(MASTER_TIER_BEFORE)
  if (tier) return [Number(tier[1])]
  return DEGREE_INSTEAD.test(sentence) ? [] : yearsIn(sentence)
}

// Returns the largest of the believable values, or undefined when there are none.
function largest(values: readonly number[]): number | undefined {
  const believable = values.filter((value) => value <= 20)
  return believable.length > 0 ? Math.max(...believable) : undefined
}

// Returns the largest number of years the posting requires, or undefined when it asks for none. Years that are only
// preferred are left out, so a wish list does not hide a job.
export function yearsRequired(text: string): number | undefined {
  return largest(splitSentences(text).flatMap(yearsIn))
}

// Returns the largest number of years the posting requires of someone with a master's degree, or undefined when it asks
// them for none.
export function yearsWithMaster(text: string): number | undefined {
  return largest(splitSentences(text).flatMap(yearsWithMasterIn))
}

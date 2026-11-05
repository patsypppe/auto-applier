// Reads how many years of experience a posting asks for, from phrases like "3+ years of experience" or "3-5 years in a role".
import { splitSentences } from "../tags/sentences"

// "3+ years", "3-5 years", "3 to 5 years", "at least 3 years", "a minimum of 3 years", "3 or more years", then within a few
// words something that shows the years are experience, not the company's age or the applicant's.
const YEARS = /\b(at least|a minimum of|minimum of|minimum)?\s*(\d{1,2})\s*(\+|or more|(?:-|–|to)\s*\d{1,2})?\s*(\+)?\s*years?'?\b/gi
const ABOUT_EXPERIENCE = /^[^.;]{0,40}?\b(experience|role|industry|working|work|professional|in (a|an|the) )/i
// "3+ years" or "at least 3 years" is always a requirement, so it may be followed by "of", "in" or a verb like "building".
const FIRM_FOLLOWED_BY = /^\s*(of|in|\w+ing)\b/i
const NOT_EXPERIENCE = /^\s*(of age|old|ago)\b/i
const ONLY_PREFERRED = /\b(preferred|nice to have|bonus|a plus|ideally)\b/i
// "5+ years of Python preferred": the wish comes after the years, before the next comma.
const PREFERRED_AFTER = /^[^.;,]{0,60}\b(preferred|nice to have|a plus|bonus)\b/i

// Returns the years each matching phrase in one sentence requires, leaving out years the sentence only prefers.
function yearsIn(sentence: string): number[] {
  const found: number[] = []
  for (const match of sentence.matchAll(YEARS)) {
    const before = sentence.slice(0, match.index ?? 0)
    const after = sentence.slice((match.index ?? 0) + match[0].length)
    const firm = Boolean(match[1] || match[3] || match[4])
    if (ONLY_PREFERRED.test(before) || PREFERRED_AFTER.test(after) || NOT_EXPERIENCE.test(after)) continue
    if (ABOUT_EXPERIENCE.test(after) || (firm && FIRM_FOLLOWED_BY.test(after))) found.push(Number(match[2]))
  }
  return found
}

// Returns the largest number of years the posting requires, or undefined when it asks for none. Years that are only
// preferred are left out, so a wish list does not hide a job.
export function yearsRequired(text: string): number | undefined {
  const years = splitSentences(text)
    .flatMap(yearsIn)
    .filter((value) => value <= 20)
  return years.length > 0 ? Math.max(...years) : undefined
}

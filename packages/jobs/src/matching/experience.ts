// Reads how many years of experience a posting asks for, from phrases like "3+ years of experience" or "3-5 years in a role".
import { splitSentences } from "../tags/sentences"

// "3+ years", "3-5 years", "3 to 5 years", "at least 3 years", "a minimum of 3 years", "3 or more years", then within a few
// words something that shows the years are experience, not the company's age or the applicant's.
const YEARS = /\b(?:at least|a minimum of|minimum of|minimum)?\s*(\d{1,2})\s*(?:\+|or more|(?:-|–|to)\s*\d{1,2})?\s*\+?\s*years?'?\b/gi
const ABOUT_EXPERIENCE = /^[^.;]{0,40}?\b(experience|role|industry|working|work|professional|in (a|an|the) )/i
const ONLY_PREFERRED = /\b(preferred|nice to have|bonus|a plus|ideally)\b/i

// Returns the years each matching phrase in one sentence asks for.
function yearsIn(sentence: string): number[] {
  const found: number[] = []
  for (const match of sentence.matchAll(YEARS)) {
    const after = sentence.slice((match.index ?? 0) + match[0].length)
    if (ABOUT_EXPERIENCE.test(after)) found.push(Number(match[1]))
  }
  return found
}

// Returns the largest number of years the posting requires, or undefined when it asks for none. Sentences that only
// prefer more experience are left out, so a wish list does not hide a job.
export function yearsRequired(text: string): number | undefined {
  const years = splitSentences(text)
    .filter((sentence) => !ONLY_PREFERRED.test(sentence))
    .flatMap(yearsIn)
    .filter((value) => value <= 20)
  return years.length > 0 ? Math.max(...years) : undefined
}

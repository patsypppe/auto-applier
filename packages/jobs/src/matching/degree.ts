// Reads the lowest degree a posting requires, from phrases like "Bachelor's degree in Computer Science" or "PhD in
// Statistics", leaving out degrees that are only preferred.
import { splitSentences } from "../tags/sentences"
import type { Degree } from "../types"

export const DEGREES: readonly Degree[] = ["associate", "bachelor", "master", "phd"]

// "MS", "BS", "BA" and "PhD" count only before words that make them a degree ("in", "or", "with", "+", "/", "degree"),
// so "MS Office", "Business Analyst (BA)", "a Stanford PhD spinout" and "PhD students" do not. "PHD filters" is a
// tracking algorithm, so "PhD" is matched in its own spelling only.
const SHORT_FORM_CONTEXT = String.raw`(?=\s*(\/|in\b|degree|or\b|with\b|\+|,|:|\(|\)))`
const PHD_CONTEXT = String.raw`(?=\s*($|[.;:,)\/+(]|in\b|or\b|degree|with\b|program|candidate|holder|required))`
const PATTERNS: readonly [Degree, RegExp][] = [
  ["phd", new RegExp(String.raw`\bPh\.?\s?D\b\.?${PHD_CONTEXT}`, "g")],
  ["phd", /\b(doctorate|doctoral degree)(?![a-z])/gi],
  ["master", /\b(master('|’)?s|master degree|M\.S\.|M\.Sc|MSc|MBA|M\.Eng|MEng|advanced degree|graduate degree)(?![a-z])/gi],
  // "Master of Science", "Master/PhD", "Master or PhD", but not "a master of Python" or "master/reference data".
  ["master", /\bmaster(?= of (science|arts|engineering|business|public|fine|education|social)\b|\s*\/\s*(Ph|doctor)|\s+(or|in)\b)/gi],
  // "MS" in a list of state codes ("LA, MS, MT") is Mississippi.
  ["master", new RegExp(String.raw`(?<![A-Z]{2},\s)\bMS${SHORT_FORM_CONTEXT}(?!\s*[A-Z]{2}\b,)`, "g")],
  ["bachelor", /\b(bachelor('|’)?s?|B\.S\.?|B\.Sc|BSc|B\.A\.|undergraduate (degree|or|student|program)|(4|four)[- ]year degree)(?![a-z])/gi],
  ["bachelor", new RegExp(String.raw`\b(BS|BA)${SHORT_FORM_CONTEXT}`, "g")],
  ["associate", /\bassociate('|’)?s? degree\b/gi],
]

const PREFERRED_BEFORE = /\b(preferred|preferably|nice to have|bonus|a plus|ideally|desired|preference|recommended)\b/i
// "Master's preferred" or "PhD (preferred)": the wish comes right after the degree, before the next comma or bracket.
const PREFERRED_AFTER = /^\s*\(?\s*(preferred|a plus|nice to have|bonus|desired)\b|^[^.;,()]{0,40}\b(preferred|a plus|nice to have|bonus|desired)\b/i
// A degree that experience can stand in for is not a requirement.
const EXPERIENCE_INSTEAD = /\b(or (an? )?equivalent|in lieu of|comparable experience)\b|\bequivalent\b[^.;]{0,30}\bexperience\b/i
// Sentences that name a degree without asking for it: "You don't need: a PhD", "typical but not required", or a line
// about the founders or the company ("CTO & Co-founder: PhD in Computer Science", "We spun out of a PhD program").
const NOT_ASKED = /\b(don't need|do not need|not required|not necessary|not a requirement|typical|typically|often|usually|encourage|co-?founder|founded|spun out|spinout|backed by)\b/i
// A bracketed alternative or example, "(or 6+ years with a PhD)" or "(e.g. a PhD in a relevant area)". Its degrees
// count only next to a degree outside it, as in "PhD (or BS/MS degree with equivalent level of experience)".
const ASIDE = /\(\s*((or|eg|for example|such as)\b|e\.g\.|i\.e\.)[^)]*\)/gi

// A short line that starts a list of wishes, or one that starts the next list.
// "Ideally" starts wishes, but "The ideal candidate will have:" starts the requirements.
const PREFERRED_HEADING = /\b(preferred|nice to have|bonus|a plus|desired|ideally|stand out|extra credit)\b/i
const OTHER_HEADING = /\b(required|requirements|minimum|basic|must|qualifications|what you|you have|you bring|you will|about|responsibilities|benefits|who you are)\b/i
// A line such as "Minimum education: Bachelor's degree" states the requirement wherever it sits.
const REQUIREMENT_LINE = /^[\s*•-]*(minimum education|minimum qualifications?|education|required|requirements?)\s*:/i

// Returns the degrees one piece of text names, leaving out the ones it marks as only preferred.
function namedIn(text: string): Degree[] {
  return PATTERNS.flatMap(([degree, pattern]) =>
    [...text.matchAll(pattern)]
      .filter((match) => {
        const start = match.index ?? 0
        const clause = text.slice(0, start).split(/[,;)]/).pop() ?? ""
        return !PREFERRED_BEFORE.test(clause) && !PREFERRED_AFTER.test(text.slice(start + match[0].length))
      })
      .map(() => degree),
  )
}

// Returns every degree the sentence asks for, with the degrees in a bracketed alternative only when the sentence itself
// names one.
function degreesIn(sentence: string): Degree[] {
  if (NOT_ASKED.test(sentence)) return []
  const asides = sentence.match(ASIDE) ?? []
  const main = namedIn(sentence.replace(ASIDE, ""))
  return main.length > 0 ? [...main, ...asides.flatMap(namedIn)] : []
}

// Returns true when the line is a short heading, with no degree in it, rather than a sentence.
function isHeading(line: string): boolean {
  const plain = line.replace(/^[\s*•-]+/, "").trim()
  return plain.length > 0 && plain.length <= 60 && plain.split(/\s+/).length <= 6 && PATTERNS.every(([, pattern]) => !new RegExp(pattern).test(plain))
}

// Returns the lowest of the degrees, or undefined when there are none.
function lowest(degrees: readonly Degree[]): Degree | undefined {
  return DEGREES.find((degree) => degrees.includes(degree))
}

// Returns the lowest degree the posting requires, or undefined when it requires none. A degree in the title, as in
// "Data Scientist Intern - PhD", decides; otherwise the lowest degree the text requires does, since a higher one is
// usually listed as a plus. Lines under a heading such as "Preferred Qualifications" are left out. When the posting
// also accepts experience in place of the same or a lower degree ("Bachelor's degree or equivalent"), nothing is
// required.
export function degreeRequired(text: string, title: string): Degree | undefined {
  const fromTitle = lowest(degreesIn(title))
  if (fromTitle) return fromTitle

  let preferredSection = false
  const required: Degree[] = []
  const replaceable: Degree[] = []
  for (const line of text.split("\n")) {
    if (isHeading(line)) {
      preferredSection = PREFERRED_HEADING.test(line) || (preferredSection && !OTHER_HEADING.test(line))
      continue
    }
    if (REQUIREMENT_LINE.test(line)) preferredSection = false
    if (preferredSection) continue
    for (const sentence of splitSentences(line)) (EXPERIENCE_INSTEAD.test(sentence) ? replaceable : required).push(...degreesIn(sentence))
  }

  const strict = lowest(required)
  const instead = lowest(replaceable)
  if (instead && (!strict || DEGREES.indexOf(instead) <= DEGREES.indexOf(strict))) return undefined
  return strict
}

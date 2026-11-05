// The phrase rules for work-authorization tags, as data: what each tag needs to see in a sentence and what rules it out.
import type { AuthTag } from "../types"

export type Rule = { tag: AuthTag; matches: (sentence: string) => boolean }

const US = String.raw`(?:U\.?S\.?A?|United States|American)`

// Words that put "sponsor" in the immigration sense rather than the business one ("technical sponsor", "event sponsors").
const VISA_CONTEXT = /\b(visas?|immigration|H-?1B|green card|authori[sz]ed to work|work authori[sz]ation|work permit|employment pass|transfers?)\b/i

const REFUSES_SPONSORSHIP = [
  /\b(unable to|not able to|cannot|can ?not|will not|won't|do not|does not|don't|doesn't|not)\b[^.;]{0,40}?\bsponsor(s|ship|ing)?\b/i,
  /\bwithout\b[^.;]{0,40}?\bsponsorship\b/i,
  /\bno\s+(visa\s+|employer\s+|H-?1B\s+)?sponsorship\b/i,
  /\bsponsorship\s+(is\s+|will\s+)?(not|un)\s*(available|offered|provided|possible)\b/i,
]
// "Disclose any need for sponsorship" asks a question rather than refusing, and "not limited to" is not a refusal either.
const ASKS_ONLY = /\b(disclose|let us know|tell us|indicate)\b/i
const NOT_LIMITED_TO = /\bnot limited to\b/gi
const LATER_TOO = /\b(now or in the future|current or future|now or at any time in the future|in the future)\b/i

const OFFERS_SPONSORSHIP = [
  /\b(will|can|could|is able to|are able to|happy to|open to|may)\s+(\w+\s+){0,2}sponsor(s|ship)?\b/i,
  /\b(visa|H-?1B)\s+sponsorship\s+(is\s+)?(available|offered|provided)\b/i,
  /\b(we|they)\s+(do|does)\s+sponsor\b/i,
]

const CITIZENS_ONLY = [
  new RegExp(String.raw`\b${US}\s+citizenship\b[^.;]{0,30}\brequired\b`, "i"),
  new RegExp(String.raw`\bmust be (a\s+)?${US}\s+citizen(s|ship)?\b`, "i"),
  new RegExp(String.raw`\brequires?\s+${US}\s+citizenship\b`, "i"),
  new RegExp(String.raw`\brequires?\b[^.;]{0,40}\bto be\s+${US}\s+citizens\b`, "i"),
  new RegExp(String.raw`\bonly\s+(hire\s+)?${US}\s+citizens\b`, "i"),
  /\bcitizenship (is )?required\b/i,
]
// A rule that also lets in green card holders, refugees or asylees is a U.S. person rule, not a citizens-only one.
const NAMES_OTHER_PERSONS = /\b(permanent resident|green card|lawful permanent|refugee|asyl(ee|um)|protected individual|U\.?S\.? persons?|or national)\b/i

// "May be required for some positions" describes other jobs, not a rule for this one.
const HEDGED = /\b(may|might|could)\s+(be\s+)?(required|need)|\bsome positions\b|\bcertain (other )?(restricted )?positions\b/i

const US_PERSONS = [
  /\bU\.?S\.?\s+persons?\b/i,
  /\bUS persons?\b/i,
  /\bcitizens?\b[^;]{0,200}\b(permanent resident|green card)/i,
  /\bcitizenship\b[^;]{0,120}\b(permanent residen\w*|refugee|asylee)/i,
]
const A_REQUIREMENT = /\b(must|only|required|requires|requirement|eligible|conform|policy)\b/i

const CLEARANCE =
  /\b(security clearances?|(government|federal|national security|DoD|DoW) clearances?|TS\/SCI|top secret|secret clearance|secret security|DOE\s+(level\s+)?Q|clearance level|active clearance|polygraph)\b/i
const PUBLIC_TRUST = /\bpublic trust\b/i
const REAL_CLEARANCE = /\b(secret|TS\/SCI|SCI|DOE|polygraph)\b/i

// A line that lists something as a skill ("experience with E-Verify filings") is not the employer's own rule.
const SKILL = /\b(experience|familiarity|knowledge|understanding|background in)\b/i
const MAKES_IT_A_RULE = /\b(must|required|requires|requirement|eligible|eligibility|ability to obtain|able to obtain|active|current|maintain)\b/i

const OPT_CPT = /\b(F-1|OPT|CPT|STEM OPT)\b/
const WELCOMES = /\b(welcome|eligible|encourag\w*|accept\w*|consider\w*|open to)\b/i
const STUDENT_CONTEXT = /\b(F-1|student|STEM OPT|visa|practical training|OPT)\b/

const E_VERIFY = /\bE-?Verify\b/i

// Words that show a sentence is about work authorization even when no rule above could read it.
const ABOUT_WORK_AUTHORIZATION = [
  /\bsponsor(s|ship)?\b[^.;]{0,40}\b(visas?|work|employment|immigration)\b/i,
  /\bvisa sponsor/i,
  /\bH-?1B\b/i,
  /\bexport[- ]control/i,
  /\bpublic trust\b/i,
  /\bcitizenship\b/i,
]
// OPT and CPT are also other acronyms ("Cyber Penetration Teams (CPT)"), so they count only next to student or visa words.
const OPT_CPT_WITH_CONTEXT = /\b(student|visa|F-1|practical training)\b/i
// Equal-opportunity lists and agency names mention citizenship without making any rule.
const NOT_A_RULE = /\b(regardless of|without regard|national origin|protected (class|characteristic|veteran|status)|discriminat\w*|Citizenship and Immigration Services)\b/i

// Returns true when any pattern matches the sentence.
function any(patterns: readonly RegExp[], sentence: string): boolean {
  return patterns.some((pattern) => pattern.test(sentence))
}

// Returns true when the sentence names something as a skill rather than requiring it.
function onlyASkill(sentence: string): boolean {
  return SKILL.test(sentence) && !MAKES_IT_A_RULE.test(sentence)
}

// Returns true when the sentence refuses visa sponsorship.
function refusesSponsorship(sentence: string): boolean {
  const plain = sentence.replace(NOT_LIMITED_TO, "")
  if (ASKS_ONLY.test(plain)) return false
  return any(REFUSES_SPONSORSHIP, plain) && (VISA_CONTEXT.test(plain) || /\bsponsorship\b/i.test(plain))
}

export const RULES: readonly Rule[] = [
  {
    tag: "citizen-only",
    matches: (s) => any(CITIZENS_ONLY, s) && !NAMES_OTHER_PERSONS.test(s) && !NOT_A_RULE.test(s) && !HEDGED.test(s),
  },
  {
    tag: "us-person",
    matches: (s) => any(US_PERSONS, s) && A_REQUIREMENT.test(s) && !NOT_A_RULE.test(s) && !onlyASkill(s) && !HEDGED.test(s),
  },
  {
    tag: "clearance",
    matches: (s) => CLEARANCE.test(s) && !(PUBLIC_TRUST.test(s) && !REAL_CLEARANCE.test(s)) && !onlyASkill(s) && !HEDGED.test(s),
  },
  { tag: "no-future-sponsorship", matches: (s) => refusesSponsorship(s) && LATER_TOO.test(s) },
  { tag: "no-sponsorship", matches: (s) => refusesSponsorship(s) && !LATER_TOO.test(s) },
  {
    tag: "sponsors",
    matches: (s) => any(OFFERS_SPONSORSHIP, s) && VISA_CONTEXT.test(s) && !any(REFUSES_SPONSORSHIP, s),
  },
  {
    tag: "opt-cpt-welcome",
    matches: (s) => OPT_CPT.test(s) && WELCOMES.test(s) && STUDENT_CONTEXT.test(s) && !/\b(not|no|cannot|unable)\b/i.test(s),
  },
  { tag: "e-verify", matches: (s) => E_VERIFY.test(s) && !onlyASkill(s) },
]

// Returns true when the sentence is about work authorization but none of the rules could say what it means.
export function isUnclear(sentence: string): boolean {
  const aboutIt = any(ABOUT_WORK_AUTHORIZATION, sentence) || (OPT_CPT.test(sentence) && OPT_CPT_WITH_CONTEXT.test(sentence))
  return aboutIt && !NOT_A_RULE.test(sentence)
}

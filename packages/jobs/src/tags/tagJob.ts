// Tags a job with what its text says about work authorization, keeping the sentence that says it as evidence.
import { namesOnlyAnotherCountry } from "../sources/country"
import type { AuthTag, JobRecord, Tag } from "../types"
import { isUnclear, RULES } from "./rules"
import { splitSentences } from "./sentences"

const RESTRICTIONS: ReadonlySet<AuthTag> = new Set([
  "citizen-only",
  "us-person",
  "clearance",
  "no-sponsorship",
  "no-future-sponsorship",
  "unclear",
])

// Returns the tags one sentence carries: every rule that matches one of its parts, or "unclear" when it is about work
// authorization but no rule could read it. Parts are split at semicolons, so "must be a U.S. person; a clearance may be
// required" keeps the firm first part even though the second is hedged.
function tagsOfSentence(sentence: string): AuthTag[] {
  if (namesOnlyAnotherCountry(sentence)) return []
  const parts = sentence.split(/;\s*/)
  const tags = RULES.filter((rule) => parts.some((part) => rule.matches(part))).map((rule) => rule.tag)
  return tags.length > 0 ? tags : isUnclear(sentence) ? ["unclear"] : []
}

// Returns each kind of tag once, from the first sentence that shows it, or a single "not-stated" when the text says nothing.
// A job outside the US gets no restriction tags, since the rules its text states are about another country.
export function tagJob(job: Pick<JobRecord, "description" | "country">): Tag[] {
  const sentences = splitSentences(job.description)
  const found = new Map<AuthTag, Tag>()

  sentences.forEach((sentence, index) => {
    for (const tag of tagsOfSentence(sentence)) {
      if (found.has(tag) || (job.country === "other" && RESTRICTIONS.has(tag))) continue
      const context = sentences.slice(Math.max(0, index - 1), index + 2).join(" ")
      found.set(tag, { tag, evidence: sentence, context })
    }
  })

  return found.size > 0 ? [...found.values()] : [{ tag: "not-stated", evidence: "", context: "" }]
}

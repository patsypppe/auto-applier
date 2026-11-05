// Finds the skills a piece of text names, in the order it first names them, using the skill list and any extra skills.
import { splitSentences } from "../tags/sentences"
import { LANGUAGE_WORDS, SKILLS, type SkillEntry } from "./skillList"

// Escapes a skill name so characters like "+", "#" and "." are matched as themselves.
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
}

// Builds one pattern for a skill and its other names. The edges stop "Java" matching inside "JavaScript", "C" inside
// "C++", and "R" in "R&D".
function patternFor(entry: SkillEntry): RegExp {
  const names = [entry.name, ...(entry.aliases ?? [])].map(escape).join("|")
  return new RegExp(`(?<![A-Za-z0-9+#&.])(?:${names})(?![A-Za-z0-9+#&])`, entry.caseSensitive ? "g" : "gi")
}

const PATTERNS = SKILLS.map((entry) => ({ entry, pattern: patternFor(entry) }))

// Returns where the skill is first named, or -1. A short language name counts only in a sentence that names another language.
function firstMention(text: string, sentences: readonly string[], entry: SkillEntry, pattern: RegExp): number {
  if (!entry.needsLanguageNearby) return text.search(pattern)

  const sentence = sentences.find((candidate) => candidate.search(pattern) !== -1 && LANGUAGE_WORDS.test(candidate))
  return sentence === undefined ? -1 : text.indexOf(sentence) + sentence.search(pattern)
}

// Returns the names of the skills the text names, each once, in the order the text first names them.
export function findSkills(text: string, extra: readonly string[] = []): string[] {
  const sentences = splitSentences(text)
  const known = new Set(SKILLS.map((entry) => entry.name.toLowerCase()))
  const extras = extra.filter((name) => !known.has(name.toLowerCase())).map((name) => ({ entry: { name }, pattern: patternFor({ name }) }))

  return [...PATTERNS, ...extras]
    .map(({ entry, pattern }) => ({ name: entry.name, at: firstMention(text, sentences, entry, pattern) }))
    .filter((found) => found.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((found) => found.name)
}

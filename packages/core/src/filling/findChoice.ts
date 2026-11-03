// Picks the one choice that matches a value: an exact match first, then a single whole-word match.

// Lowercases text and reduces it to words separated by single spaces.
function toWords(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

// Returns the choice that matches the value, or undefined when none fits or more than one does.
export function findChoice<T>(value: string, choices: T[], textOf: (choice: T) => string): T | undefined {
  const wanted = toWords(value)
  if (wanted === "") return undefined

  const exact = choices.filter((choice) => toWords(textOf(choice)) === wanted)
  if (exact.length > 0) return exact[0]

  const containing = choices.filter((choice) => ` ${toWords(textOf(choice))} `.includes(` ${wanted} `))
  return containing.length === 1 ? containing[0] : undefined
}

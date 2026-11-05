// Writes a company name in one comparable form, so "Stripe, Inc." on a job board and "STRIPE LLC" in a USCIS filing agree.
const ENDINGS = new Set(["inc", "incorporated", "llc", "l l c", "corp", "corporation", "co", "company", "ltd", "limited", "lp", "llp", "pllc", "pc", "pbc", "plc", "holdings"])

// Returns where "doing business as" starts (written dba, d/b/a or d b a), or the word count when it is not there.
function doingBusinessAs(words: readonly string[]): number {
  const index = words.findIndex((word, at) => word === "dba" || (word === "d" && words[at + 1] === "b" && words[at + 2] === "a"))
  return index === -1 ? words.length : index
}

// Lowercases the name, writes & as "and", turns punctuation into spaces, keeps the legal name before any "doing business
// as", and drops legal endings like Inc or LLC, keeping at least one word.
export function normalizeName(name: string): string {
  const all = name
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word !== "")
  const words = all.slice(0, Math.max(1, doingBusinessAs(all)))
  while (words.length > 1 && ENDINGS.has(words.at(-1)!)) words.pop()
  return words.join(" ")
}

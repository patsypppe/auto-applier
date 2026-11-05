// Writes a company name in one comparable form, so "Stripe, Inc." on a job board and "STRIPE LLC" in a USCIS filing agree.
const ENDINGS = new Set(["inc", "incorporated", "llc", "l l c", "corp", "corporation", "co", "company", "ltd", "limited", "lp", "llp", "pllc", "pc", "pbc", "plc", "holdings"])

// Lowercases the name, writes & as "and", turns punctuation into spaces and drops legal endings like Inc or LLC, keeping at
// least one word.
export function normalizeName(name: string): string {
  const words = name
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word !== "")
  while (words.length > 1 && ENDINGS.has(words.at(-1)!)) words.pop()
  return words.join(" ")
}

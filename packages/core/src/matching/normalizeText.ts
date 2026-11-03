// Shared text clean-up so labels and attribute names can be compared with simple patterns.

// Lowercases text and turns underscores, dashes, dots, brackets and camelCase humps into spaces.
export function normalizeText(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.[\]]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

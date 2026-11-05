// Splits job text into sentences, one list item or line at a time, without breaking at abbreviations like "U.S.".
const ABBREVIATIONS = /\b(U\.S\.C\.|U\.S\.A\.|U\.S\.|Inc\.|Ltd\.|Corp\.|Co\.|e\.g\.|i\.e\.|etc\.|vs\.|No\.|St\.|Dr\.|Mr\.|Ms\.|Mrs\.|[A-Z]\.)/g
const HIDDEN_DOT = "\u0000"

// Splits one line at sentence ends, after hiding the dots inside abbreviations so they are not taken as ends.
function splitLine(line: string): string[] {
  const hidden = line.replace(ABBREVIATIONS, (abbreviation) => abbreviation.replaceAll(".", HIDDEN_DOT))
  return hidden
    .split(/(?<=[.!?])\s+(?=["“(\[A-Z0-9])/)
    .map((sentence) => sentence.replaceAll(HIDDEN_DOT, ".").trim())
}

// Returns the sentences of the text in order, treating every line as a break, since bullet lists often have no periods.
export function splitSentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap(splitLine)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence !== "")
}

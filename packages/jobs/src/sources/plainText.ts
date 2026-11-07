// Turns job description HTML into plain text with one line per paragraph or list item.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

const BLOCK_TAG = /<\/?(p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|blockquote)\b[^>]*>/gi

// Replaces entities like &amp;, &#8217; and &#x2014; with the characters they stand for, once.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      // A code past the last Unicode character would make fromCodePoint throw, so such an entity is left as written.
      return Number.isNaN(code) || code > 0x10ffff ? entity : String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? entity
  })
}

// Returns true when the text is HTML that was escaped once, which is how Greenhouse sends descriptions.
function isEscapedHtml(text: string): boolean {
  return !text.includes("<") && /&lt;\/?[a-z]/i.test(text)
}

// Converts HTML to plain text: tags removed, block elements on their own lines, entities decoded, spaces squashed.
export function htmlToText(html: string): string {
  const markup = isEscapedHtml(html) ? decodeEntities(html) : html

  const text = markup
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Line breaks in the HTML source are just spaces; only block tags start a new line.
    .replace(/\s+/g, " ")
    .replace(BLOCK_TAG, "\n")
    .replace(/<[^>]*>/g, "")

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n")
}

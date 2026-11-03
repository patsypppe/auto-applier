// Lists the shorter searches to try when a dropdown found nothing for the full text: the same words with the last one dropped each time.
const MIN_QUERY_CHARS = 3

// Returns the text with its last word dropped, then two words, and so on down to the first word, skipping searches too short to mean anything.
export function shorterQueries(text: string): string[] {
  const words = text.trim().split(/\s+/).filter((word) => word !== "")
  const queries: string[] = []
  for (let count = words.length - 1; count >= 1; count -= 1) {
    const query = words.slice(0, count).join(" ")
    if (query.length >= MIN_QUERY_CHARS) queries.push(query)
  }
  return queries
}

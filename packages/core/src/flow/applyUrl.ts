// Works out the address of the application page from a job posting's address, for the few job boards that put it at a fixed place.
const BOARDS: { host: string; suffix: string }[] = [
  { host: "jobs.lever.co", suffix: "apply" },
  { host: "jobs.ashbyhq.com", suffix: "application" },
]

// Returns the application page's address for a posting on a known board, or undefined when the address is not a posting or is already the application.
export function applyUrlFor(address: string): string | undefined {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return undefined
  }
  const board = BOARDS.find((candidate) => candidate.host === url.hostname)
  if (!board) return undefined

  const parts = url.pathname.split("/").filter((part) => part !== "")
  if (parts.length !== 2) return undefined
  return `${url.origin}/${parts.join("/")}/${board.suffix}`
}

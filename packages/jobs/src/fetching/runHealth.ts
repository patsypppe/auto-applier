// Decides whether a collection run went so badly, such as with the network down, that it must not replace the earlier feed.
import type { BoardResult } from "./collectBoards"

// Returns why the run should not be saved, or undefined when it looks normal. Boards that are simply gone (404) do not count.
export function brokenRunReason(results: readonly BoardResult[]): string | undefined {
  if (results.length === 0) return undefined

  const worked = results.filter((result) => result.outcome !== "failed").length
  if (worked === 0) return "No board could be read, so the earlier feed was kept."

  const broken = results.filter((result) => result.outcome === "failed" && result.status !== 404).length
  if (broken > results.length / 2) return `${broken} of ${results.length} boards failed, so the earlier feed was kept.`
  return undefined
}

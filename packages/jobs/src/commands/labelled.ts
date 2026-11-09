// The "labelled" command: scores the readers against the hand-labelled postings in test/fixtures, for an F-1 OPT student
// with a STEM degree and a master's, so a rule change can be measured before it is kept.
import { readFile } from "node:fs/promises"
import { scoreLabels, type LabelledJob, type Me } from "../feed/scoreLabels"

export const LABELLED_USER: Me = {
  workAuth: { status: "f1-opt", needsSponsorshipLater: true, stemDegree: true, clearance: "none" },
  maxYears: 2,
  degree: "master",
}

// Prints each field's score and the wrong hides; with --misses, also every miss.
export async function runLabelled(args: readonly string[], file: string, print: (line: string) => void): Promise<void> {
  const jobs = JSON.parse(await readFile(file, "utf8")) as LabelledJob[]
  const { fields, hide } = scoreLabels(jobs, LABELLED_USER)

  for (const [name, score] of Object.entries(fields)) print(`${name}: ${score.right} of ${score.total} right`)
  print(`hide or show: ${hide.right} of ${hide.total} right (${hide.wronglyHidden.length} wrongly hidden, ${hide.wronglyShown.length} wrongly shown)`)
  if (!args.includes("--misses")) return

  for (const [name, score] of Object.entries(fields)) for (const miss of score.misses) print(`${name} miss: ${miss}`)
  for (const miss of [...hide.wronglyHidden, ...hide.wronglyShown]) print(`hide miss: ${miss}`)
}

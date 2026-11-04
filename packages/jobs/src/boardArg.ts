// Reads the "--board ats:slug" option that picks one job board to collect.
import type { Ats } from "./types"

const SUPPORTED: readonly Ats[] = ["greenhouse"]
const USAGE = "Use --board greenhouse:<slug>, for example --board greenhouse:stripe."

export type BoardChoice = { ats: Ats; slug: string }

// Returns the value given after --board, in either "--board x" or "--board=x" form.
function boardValue(args: readonly string[]): string | undefined {
  const index = args.indexOf("--board")
  if (index !== -1) return args[index + 1]
  return args.find((arg) => arg.startsWith("--board="))?.slice("--board=".length)
}

// Reads which board to collect from the command line arguments, or throws a message saying what to type.
export function readBoardArg(args: readonly string[]): BoardChoice {
  const [ats = "", slug = ""] = (boardValue(args) ?? "").split(":")
  if (ats === "" || slug.trim() === "") throw new Error(USAGE)

  const supported = SUPPORTED.find((name) => name === ats)
  if (!supported) throw new Error(`'${ats}' is not supported yet. ${USAGE}`)

  return { ats: supported, slug: slug.trim() }
}

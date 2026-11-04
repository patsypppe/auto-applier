// Reads the "--board site:slug" options that pick which job boards to collect.
import type { Ats } from "./types"

const SUPPORTED: readonly Ats[] = ["greenhouse", "lever", "ashby"]
const USAGE = `Use --board <site>:<slug>, for example --board greenhouse:stripe. Sites: ${SUPPORTED.join(", ")}.`

export type BoardChoice = { ats: Ats; slug: string }

// Returns every value given after --board, in either "--board x" or "--board=x" form, in order.
function boardValues(args: readonly string[]): string[] {
  return args.flatMap((arg, index) => {
    if (arg === "--board") return [args[index + 1] ?? ""]
    return arg.startsWith("--board=") ? [arg.slice("--board=".length)] : []
  })
}

// Reads one "site:slug" value, or throws a message saying what to type.
function readBoard(value: string): BoardChoice {
  const [ats = "", slug = ""] = value.split(":")
  if (ats === "" || slug.trim() === "") throw new Error(USAGE)

  const supported = SUPPORTED.find((name) => name === ats)
  if (!supported) throw new Error(`'${ats}' is not supported yet. ${USAGE}`)

  return { ats: supported, slug: slug.trim() }
}

// Reads which boards to collect from the command line arguments, or throws a message saying what to type.
export function readBoardArgs(args: readonly string[]): BoardChoice[] {
  const values = boardValues(args)
  if (values.length === 0) throw new Error(USAGE)
  return values.map(readBoard)
}

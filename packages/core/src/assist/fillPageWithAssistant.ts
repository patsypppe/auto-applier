// Fills a page with the rules, asks the LLM to answer what the rules could not, scans again for fields that appeared, and checks the work.
import { discoverFields } from "../fields/discoverFields"
import type { FormField } from "../fields/types"
import { DEFAULT_SETUP, fillFields, fillWith } from "../fill/fillPage"
import type { FieldReport, FillSetup } from "../fill/fillPage"
import { countFilled } from "../fill/progress"
import type { ProgressListener } from "../fill/progress"
import type { LLMClient } from "../ports/LLMClient"
import type { ProfileKey } from "../profile/keys"
import type { Profile } from "../profile/types"
import type { EarlierAnswer, PageInfo } from "./answerFieldsPrompt"
import { answerLeftovers } from "./answerLeftovers"
import type { AskSetup } from "./answerLeftovers"
import { retryRejected } from "./retryRejected"
import { checkFilled } from "./verifyFilled"

export type AssistedResult = {
  reports: FieldReport[]
  notes: string[]
}

export type RescanOptions = { passes: number; waitMs: number; maxMs: number }

export type AssistOptions = {
  setup?: FillSetup
  jobContext?: string
  page?: PageInfo
  rescan?: Partial<RescanOptions>
  onProgress?: ProgressListener
}

export const DEFAULT_RESCAN: RescanOptions = { passes: 3, waitMs: 250, maxMs: 60_000 }

const EDUCATION_KEYS = new Set<ProfileKey>(["school", "degree", "fieldOfStudy"])
const OTHER_OPTION = "Other"

type PassResult = { reports: FieldReport[]; answered: EarlierAnswer[]; note?: string }

// Returns a listener that adds the fields of earlier passes to the totals, so the progress bar keeps counting up.
function shifted(onProgress: ProgressListener | undefined, previous: readonly FieldReport[]): ProgressListener | undefined {
  if (!onProgress) return undefined
  const done = countFilled(previous)
  return (progress) => onProgress({ total: previous.length + progress.total, filled: done + progress.filled, phase: progress.phase })
}

// Returns true for an education dropdown whose profile value could not be found in the page's list.
function isMissingFromList(report: FieldReport): boolean {
  const { outcome } = report
  return (
    report.field.kind === "combobox" &&
    report.profileKey !== undefined &&
    EDUCATION_KEYS.has(report.profileKey) &&
    outcome.status === "failed" &&
    (outcome.code === "no-option-match" || outcome.code === "no-options")
  )
}

// Picks "Other" in each education dropdown that still has no match, reporting it for the user to check; a dropdown with no such option stays as it was.
async function pickOtherWhereMissing(reports: FieldReport[], setup: FillSetup, onProgress?: ProgressListener): Promise<FieldReport[]> {
  const result: FieldReport[] = []
  for (const [index, report] of reports.entries()) {
    if (!isMissingFromList(report)) {
      result.push(report)
      continue
    }
    const outcome = await fillWith(setup.fillers, report.field, OTHER_OPTION)
    const picked = outcome.status === "filled"
    result.push(picked ? { ...report, outcome, source: "fallback" } : report)
    if (picked) onProgress?.({ total: reports.length, filled: countFilled([...result, ...reports.slice(index + 1)]), phase: "answering" })
  }
  return result
}

// Returns the reason an LLM step failed, as the note shown to the user.
function skippedNote(error: unknown): string {
  return `AI help skipped: ${error instanceof Error ? error.message : "The LLM request failed"}`
}

// Fills the given fields with the rules, asks the model about the leftovers, and picks "Other" where an education list has no match; a model failure keeps what the rules filled.
async function runPass(fields: FormField[], previous: readonly FieldReport[], ask: AskSetup, onProgress?: ProgressListener): Promise<PassResult> {
  const listener = shifted(onProgress, previous)
  const byRules = await fillFields(fields, ask.profile, ask.setup, listener)
  try {
    const { reports, answered } = await answerLeftovers(byRules, ask, listener)
    return { reports: await pickOtherWhereMissing(reports, ask.setup, listener), answered }
  } catch (error: unknown) {
    return { reports: await pickOtherWhereMissing(byRules, ask.setup, listener), answered: [], note: skippedNote(error) }
  }
}

// Waits the given number of milliseconds, so a page can show what an answer reveals.
function pause(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms))
}

// Returns the fields on the page that were not there, or not handled, in the earlier passes.
function newFields(root: ParentNode, seen: ReadonlySet<HTMLElement>): FormField[] {
  return discoverFields(root).filter((field) => !seen.has(field.element))
}

// Fills the page; then, while answers reveal new fields, fills those too, up to the allowed passes and time.
export async function fillPageWithAssistant(
  root: ParentNode,
  profile: Profile,
  llm: LLMClient,
  options: AssistOptions = {},
): Promise<AssistedResult> {
  const setup = options.setup ?? DEFAULT_SETUP
  const rescan = { ...DEFAULT_RESCAN, ...options.rescan }
  const base = { profile, llm, setup, jobContext: options.jobContext ?? "", page: options.page }
  const startedAt = Date.now()

  let reports: FieldReport[] = []
  let earlier: EarlierAnswer[] = []
  const notes = new Set<string>()
  const seen = new Set<HTMLElement>()

  let fields = discoverFields(root)
  for (let pass = 0; fields.length > 0; pass += 1) {
    fields.forEach((field) => seen.add(field.element))
    const result = await runPass(fields, reports, { ...base, earlier }, options.onProgress)
    reports = [...reports, ...result.reports]
    earlier = [...earlier, ...result.answered]
    if (result.note) notes.add(result.note)

    if (pass >= rescan.passes || Date.now() - startedAt >= rescan.maxMs) break
    await pause(rescan.waitMs)
    fields = newFields(root, seen)
  }

  try {
    const retried = await retryRejected(checkFilled(reports), { ...base, earlier }, options.onProgress)
    return { reports: retried.reports, notes: [...notes] }
  } catch (error: unknown) {
    notes.add(skippedNote(error))
    return { reports: checkFilled(reports), notes: [...notes] }
  }
}

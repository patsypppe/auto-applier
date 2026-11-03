// Fills a page with the rules first, then asks the LLM for help only with what the rules could not decide.
import type { FieldKind, FormField } from "../fields/types"
import { DEFAULT_SETUP, fillPage, fillWith } from "../fill/fillPage"
import type { FieldReport, FillSetup } from "../fill/fillPage"
import type { LLMClient } from "../ports/LLMClient"
import type { ProfileKey } from "../profile/keys"
import { resolveValue } from "../profile/resolveValue"
import type { Profile } from "../profile/types"
import { buildAnswerQuestionsPrompt, parseAnswers, profileSliceFor } from "./answerQuestionsPrompt"
import { isFreeTextQuestion } from "./isFreeTextQuestion"
import { buildMapFieldsPrompt, parseMapFieldsAnswer } from "./mapFieldsPrompt"
import { buildPickOptionsPrompt, parsePickedOptions } from "./pickOptionsPrompt"
import type { PickItem } from "./pickOptionsPrompt"

export type AssistedResult = {
  reports: FieldReport[]
  notes: string[]
}

export type AssistOptions = {
  setup?: FillSetup
  jobContext?: string
}

type Context = {
  reports: FieldReport[]
  profile: Profile
  llm: LLMClient
  setup: FillSetup
  jobContext: string
}

type Stage = (context: Context) => Promise<FieldReport[]>

type StuckOnOptions = { report: FieldReport; profileKey: ProfileKey; answer: string }

// Returns true when the user has already typed something into a text field.
function hasUserValue(field: FormField): boolean {
  const element = field.element as HTMLInputElement
  return field.kind === "text" && typeof element.value === "string" && element.value !== ""
}

// Returns true when something can fill the field, it has a label or name to go on, and the user has not filled it.
function canAssist(field: FormField, setup: FillSetup): boolean {
  const fillable = setup.fillers.some((filler) => filler.canFill(field))
  return fillable && (field.label !== "" || field.name !== "") && !hasUserValue(field)
}

// Returns the reports with the updated ones swapped in, keeping the page order.
function withUpdates(reports: FieldReport[], updates: Map<FieldReport, FieldReport>): FieldReport[] {
  return reports.map((report) => updates.get(report) ?? report)
}

// Looks up the profile value for the key and fills it, as a report marked as AI work.
async function fillForKey(field: FormField, profileKey: ProfileKey, context: Context): Promise<FieldReport> {
  const value = resolveValue(context.profile, profileKey)
  if (value === undefined) return { field, profileKey, outcome: { status: "no-value", profileKey }, source: "ai" }

  return { field, profileKey, outcome: await fillWith(context.setup.fillers, field, value), source: "ai" }
}

// Step 1: asks which profile key each unrecognised field wants, then fills the ones the model matched.
const mapUnmatched: Stage = async (context) => {
  const candidates = context.reports.filter(
    (report) => report.outcome.status === "unmatched" && canAssist(report.field, context.setup),
  )
  if (candidates.length === 0) return context.reports

  const answer = await context.llm.completeJson(buildMapFieldsPrompt(candidates.map((report) => report.field)))
  const updates = new Map<FieldReport, FieldReport>()
  for (const [index, key] of parseMapFieldsAnswer(answer, candidates.length)) {
    const candidate = candidates[index]
    if (candidate) updates.set(candidate, await fillForKey(candidate.field, key, context))
  }
  return withUpdates(context.reports, updates)
}

const CHOICE_KINDS = new Set<FieldKind>(["select", "radio", "checkbox-group"])

// Finds the choice fields whose key is known but whose option could not be matched, with the answer to match.
function stuckOnOptions(context: Context): StuckOnOptions[] {
  return context.reports.flatMap((report) => {
    const { outcome, field, profileKey } = report
    if (outcome.status !== "failed" || outcome.code !== "no-option-match") return []
    if (!CHOICE_KINDS.has(field.kind) || field.options.length === 0) return []
    if (profileKey === undefined) return []

    const answer = resolveValue(context.profile, profileKey)
    return answer === undefined ? [] : [{ report, profileKey, answer }]
  })
}

// Step 2: asks the model which option means the known answer, then fills the option it chose.
const pickOptions: Stage = async (context) => {
  const stuck = stuckOnOptions(context)
  if (stuck.length === 0) return context.reports

  const items: PickItem[] = stuck.map(({ report, answer }, id) => ({
    id,
    question: report.field.label || report.field.name,
    options: report.field.options,
    answer,
  }))
  const picks = parsePickedOptions(await context.llm.completeJson(buildPickOptionsPrompt(items)), items)

  const updates = new Map<FieldReport, FieldReport>()
  for (const [id, option] of picks) {
    const item = stuck[id]
    if (!item) continue
    const outcome = await fillWith(context.setup.fillers, item.report.field, option)
    updates.set(item.report, { field: item.report.field, profileKey: item.profileKey, outcome, source: "ai" })
  }
  return withUpdates(context.reports, updates)
}

// Step 3: asks the model to draft answers to free-text questions, and fills them as drafts for the user to review.
const draftAnswers: Stage = async (context) => {
  const questions = context.reports.filter(
    (report) =>
      report.outcome.status === "unmatched" && isFreeTextQuestion(report.field) && canAssist(report.field, context.setup),
  )
  if (questions.length === 0) return context.reports

  const asked = questions.map((report, id) => ({ id, question: report.field.label || report.field.name }))
  const prompt = buildAnswerQuestionsPrompt(asked, profileSliceFor(context.profile), context.jobContext)
  const answers = parseAnswers(await context.llm.completeJson(prompt), questions.length)

  const updates = new Map<FieldReport, FieldReport>()
  for (const [id, text] of answers) {
    const report = questions[id]
    if (!report) continue
    const outcome = await fillWith(context.setup.fillers, report.field, text)
    updates.set(
      report,
      outcome.status === "filled"
        ? { field: report.field, outcome: { status: "drafted" }, source: "ai" }
        : { field: report.field, outcome },
    )
  }
  return withUpdates(context.reports, updates)
}

const STAGES: Stage[] = [mapUnmatched, pickOptions, draftAnswers]

// Fills the page with the rules, then runs each AI step; the first failure stops the rest and leaves a note.
export async function fillPageWithAssistant(
  root: ParentNode,
  profile: Profile,
  llm: LLMClient,
  options: AssistOptions = {},
): Promise<AssistedResult> {
  const setup = options.setup ?? DEFAULT_SETUP
  const jobContext = options.jobContext ?? ""

  let reports = await fillPage(root, profile, setup)
  for (const stage of STAGES) {
    try {
      reports = await stage({ reports, profile, llm, setup, jobContext })
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "The LLM request failed"
      return { reports, notes: [`AI help skipped: ${reason}`] }
    }
  }
  return { reports, notes: [] }
}

// Fills a page with the rules first, then asks the LLM once to answer everything the rules could not decide.
import type { FieldKind, FormField } from "../fields/types"
import { DEFAULT_SETUP, fillPage, fillWith } from "../fill/fillPage"
import type { FieldReport, FillSetup } from "../fill/fillPage"
import { readsOptions } from "../filling/OptionReader"
import type { LLMClient } from "../ports/LLMClient"
import type { Profile } from "../profile/types"
import { buildAnswerFieldsPrompt, parseFieldAnswers } from "./answerFieldsPrompt"
import type { FieldToAnswer } from "./answerFieldsPrompt"
import { isFreeTextQuestion } from "./isFreeTextQuestion"

export type AssistedResult = {
  reports: FieldReport[]
  notes: string[]
}

export type AssistOptions = {
  setup?: FillSetup
  jobContext?: string
}

const ANSWERABLE_KINDS = new Set<FieldKind>(["text", "select", "radio", "checkbox-group", "combobox"])
const MAX_FIELDS = 40
const MAX_QUESTION_CHARS = 300

// Returns true when the user has already typed something into a text field.
function hasUserValue(field: FormField): boolean {
  const element = field.element as HTMLInputElement
  return field.kind === "text" && typeof element.value === "string" && element.value !== ""
}

// Returns true for a field the rules left undecided: not recognised, no value in the profile, or no option that matched or appeared.
function isLeftover(report: FieldReport): boolean {
  const { outcome } = report
  return (
    outcome.status === "unmatched" ||
    outcome.status === "no-value" ||
    (outcome.status === "failed" && (outcome.code === "no-option-match" || outcome.code === "no-options"))
  )
}

// Returns true when the model may answer the field: a kind it can answer, something can fill it, it has a label or name, and the user has not filled it.
function canAssist(field: FormField, setup: FillSetup): boolean {
  const fillable = setup.fillers.some((filler) => filler.canFill(field))
  return ANSWERABLE_KINDS.has(field.kind) && fillable && (field.label !== "" || field.name !== "") && !hasUserValue(field)
}

// Returns the choices to offer for a field: the ones the page lists, or for a dropdown the ones read by opening it.
async function optionsFor(field: FormField, setup: FillSetup): Promise<string[]> {
  if (field.options.length > 0) return field.options
  const reader = setup.fillers.find((filler) => filler.canFill(field) && readsOptions(filler))
  return reader && readsOptions(reader) ? reader.readOptions(field) : []
}

// Fills one field with the model's answer: a written draft is reported as a draft to review, any other answer as the AI's fill.
async function fillAnswer(report: FieldReport, item: FieldToAnswer, answer: string, setup: FillSetup): Promise<FieldReport> {
  const outcome = await fillWith(setup.fillers, report.field, answer)
  if (outcome.status !== "filled") return { field: report.field, profileKey: report.profileKey, outcome }

  return {
    field: report.field,
    profileKey: report.profileKey,
    outcome: item.longAnswer ? { status: "drafted" } : outcome,
    source: "ai",
  }
}

// Asks the model once about every leftover field, with the whole profile, and fills the answers it gives.
async function answerLeftovers(
  reports: FieldReport[],
  profile: Profile,
  llm: LLMClient,
  setup: FillSetup,
  jobContext: string,
): Promise<FieldReport[]> {
  const leftovers = reports.filter((report) => isLeftover(report) && canAssist(report.field, setup)).slice(0, MAX_FIELDS)
  if (leftovers.length === 0) return reports

  const items: FieldToAnswer[] = []
  for (const { field } of leftovers) {
    items.push({
      id: items.length,
      question: (field.label || field.name).slice(0, MAX_QUESTION_CHARS),
      kind: field.kind,
      options: await optionsFor(field, setup),
      longAnswer: isFreeTextQuestion(field),
    })
  }
  const answers = parseFieldAnswers(await llm.completeJson(buildAnswerFieldsPrompt(items, profile, jobContext)), items)

  const updates = new Map<FieldReport, FieldReport>()
  for (const [id, answer] of answers) {
    const report = leftovers[id]
    const item = items[id]
    if (report && item) updates.set(report, await fillAnswer(report, item, answer, setup))
  }
  const asked = new Set(leftovers)
  return reports.map((report) => {
    const result = updates.get(report) ?? report
    return asked.has(report) ? { ...result, askedAi: true as const } : result
  })
}

// Fills the page with the rules, then makes one AI call for the rest; if it fails, what the rules filled is kept and a note says why.
export async function fillPageWithAssistant(
  root: ParentNode,
  profile: Profile,
  llm: LLMClient,
  options: AssistOptions = {},
): Promise<AssistedResult> {
  const setup = options.setup ?? DEFAULT_SETUP
  const reports = await fillPage(root, profile, setup)

  try {
    return { reports: await answerLeftovers(reports, profile, llm, setup, options.jobContext ?? ""), notes: [] }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "The LLM request failed"
    return { reports, notes: [`AI help skipped: ${reason}`] }
  }
}

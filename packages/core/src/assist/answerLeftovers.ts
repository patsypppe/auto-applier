// Asks the model about fields and fills what it answers: used for the fields the rules left and for fields the page rejected.
import { describeFieldContext } from "../fields/fieldContext"
import type { FieldContext } from "../fields/fieldContext"
import type { FieldKind, FormField } from "../fields/types"
import { fillWith } from "../fill/fillPage"
import type { FieldReport, FillSetup } from "../fill/fillPage"
import { countFilled } from "../fill/progress"
import type { FillPhase, ProgressListener } from "../fill/progress"
import { readsOptions } from "../filling/OptionReader"
import type { LLMClient } from "../ports/LLMClient"
import { resolveValue } from "../profile/resolveValue"
import type { Profile } from "../profile/types"
import { buildAnswerFieldsPrompt, parseFieldAnswers } from "./answerFieldsPrompt"
import type { EarlierAnswer, FieldToAnswer, PageInfo } from "./answerFieldsPrompt"
import { isFreeTextQuestion } from "./isFreeTextQuestion"

export type AskSetup = {
  profile: Profile
  llm: LLMClient
  setup: FillSetup
  jobContext: string
  page?: PageInfo
  earlier: readonly EarlierAnswer[]
}

export type AskResult = { updates: Map<FieldReport, FieldReport>; answered: EarlierAnswer[] }

export type AnswerProgress = (phase: FillPhase, updates: ReadonlyMap<FieldReport, FieldReport>) => void

const ANSWERABLE_KINDS = new Set<FieldKind>(["text", "select", "radio", "checkbox-group", "combobox"])
const MAX_FIELDS = 40
const MAX_QUESTION_CHARS = 300

// Returns true when the user has already typed something into a text field.
function hasUserValue(field: FormField): boolean {
  const element = field.element as HTMLInputElement
  return field.kind === "text" && typeof element.value === "string" && element.value !== ""
}

// Returns true for a field the rules left undecided: not recognised, no value in the profile, or no option that matched or appeared.
export function isLeftover(report: FieldReport): boolean {
  const { outcome } = report
  return (
    outcome.status === "unmatched" ||
    outcome.status === "no-value" ||
    (outcome.status === "failed" && (outcome.code === "no-option-match" || outcome.code === "no-options"))
  )
}

// Returns true when the model may answer the field: a kind it can answer, something can fill it, it has a label or name, and the user has not filled it.
export function canAssist(field: FormField, setup: FillSetup): boolean {
  const fillable = setup.fillers.some((filler) => filler.canFill(field))
  return ANSWERABLE_KINDS.has(field.kind) && fillable && (field.label !== "" || field.name !== "") && !hasUserValue(field)
}

// Returns the choices to offer for a field: the ones the page lists, or for a dropdown the ones read by opening it, with those a search for the profile's value finds first.
async function optionsFor(report: FieldReport, profile: Profile, setup: FillSetup): Promise<string[]> {
  const { field } = report
  if (field.options.length > 0) return field.options
  const reader = setup.fillers.find((filler) => filler.canFill(field) && readsOptions(filler))
  if (!reader || !readsOptions(reader)) return []

  const hint = report.profileKey ? resolveValue(profile, report.profileKey) : undefined
  return reader.readOptions(field, hint)
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

// Describes each target for the model, reading the dropdown options first where the page lists none.
async function describeTargets(targets: FieldReport[], contexts: ReadonlyMap<FieldReport, FieldContext>, ask: AskSetup): Promise<FieldToAnswer[]> {
  const items: FieldToAnswer[] = []
  for (const report of targets) {
    const { field } = report
    items.push({
      id: items.length,
      question: (field.label || field.name).slice(0, MAX_QUESTION_CHARS),
      kind: field.kind,
      options: await optionsFor(report, ask.profile, ask.setup),
      longAnswer: isFreeTextQuestion(field),
      context: contexts.get(report) ?? describeFieldContext(field),
    })
  }
  return items
}

// Asks the model once about the targets and fills the answers it gives; returns the updated reports and the answers that went in.
export async function askAndFill(
  targets: FieldReport[],
  contexts: ReadonlyMap<FieldReport, FieldContext>,
  ask: AskSetup,
  progress: AnswerProgress,
): Promise<AskResult> {
  const updates = new Map<FieldReport, FieldReport>()
  if (targets.length === 0) return { updates, answered: [] }

  progress("reading", updates)
  const items = await describeTargets(targets, contexts, ask)
  progress("asking", updates)
  const prompt = buildAnswerFieldsPrompt(items, ask.profile, ask.jobContext, { page: ask.page, earlier: ask.earlier })
  const answers = parseFieldAnswers(await ask.llm.completeJson(prompt), items)

  const answered: EarlierAnswer[] = []
  for (const [id, answer] of answers) {
    const report = targets[id]
    const item = items[id]
    if (!report || !item) continue

    const result = await fillAnswer(report, item, answer, ask.setup)
    updates.set(report, result)
    if (result.outcome.status === "filled" || result.outcome.status === "drafted") answered.push({ question: item.question, answer })
    progress("answering", updates)
  }
  return { updates, answered }
}

// Asks the model once about every leftover field and fills the answers; a field that was asked is marked so.
export async function answerLeftovers(
  reports: FieldReport[],
  ask: AskSetup,
  onProgress?: ProgressListener,
): Promise<{ reports: FieldReport[]; answered: EarlierAnswer[] }> {
  const leftovers = reports.filter((report) => isLeftover(report) && canAssist(report.field, ask.setup)).slice(0, MAX_FIELDS)
  const announce: AnswerProgress = (phase, updates) => {
    onProgress?.({ total: reports.length, filled: countFilled(reports.map((each) => updates.get(each) ?? each)), phase })
  }
  const { updates, answered } = await askAndFill(leftovers, new Map(), ask, announce)

  const asked = new Set(leftovers)
  const updated = reports.map((report) => {
    const result = updates.get(report) ?? report
    return asked.has(report) ? { ...result, askedAi: true as const } : result
  })
  return { reports: updated, answered }
}

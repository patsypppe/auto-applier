// Gives the model one more try at text fields the page rejected, telling it the page's own error message.
import { describeFieldContext } from "../fields/fieldContext"
import type { FieldContext } from "../fields/fieldContext"
import type { FieldReport } from "../fill/fillPage"
import { countFilled } from "../fill/progress"
import type { ProgressListener } from "../fill/progress"
import { setNativeValue } from "../filling/setNativeValue"
import { askAndFill } from "./answerLeftovers"
import type { AnswerProgress, AskSetup } from "./answerLeftovers"
import type { EarlierAnswer } from "./answerFieldsPrompt"
import { checkFilled } from "./verifyFilled"

// Returns true for a text field we filled and the page rejected or emptied, still on the page.
function isRejectedText(report: FieldReport): boolean {
  const { outcome } = report
  return outcome.status === "failed" && outcome.code === "page-rejected" && report.field.kind === "text" && report.field.element.isConnected
}

// Returns what the model should know about a rejected field: the page's error, or why we think it was rejected.
function contextWithError(report: FieldReport): FieldContext {
  const context = describeFieldContext(report.field)
  const reason = report.outcome.status === "failed" ? report.outcome.reason : ""
  return { ...context, error: context.error ?? reason }
}

// Empties each rejected field (the fillers never overwrite a value), asks the model once more, and checks the new values.
export async function retryRejected(
  reports: FieldReport[],
  ask: AskSetup,
  onProgress?: ProgressListener,
): Promise<{ reports: FieldReport[]; answered: EarlierAnswer[] }> {
  const targets = reports.filter(isRejectedText)
  if (targets.length === 0) return { reports, answered: [] }

  const contexts = new Map(targets.map((report) => [report, contextWithError(report)]))
  for (const report of targets) setNativeValue(report.field.element as HTMLInputElement, "")

  const announce: AnswerProgress = (phase, updates) => {
    onProgress?.({ total: reports.length, filled: countFilled(reports.map((each) => updates.get(each) ?? each)), phase })
  }
  const { updates, answered } = await askAndFill(targets, contexts, ask, announce)
  return { reports: checkFilled(reports.map((report) => updates.get(report) ?? report)), answered }
}

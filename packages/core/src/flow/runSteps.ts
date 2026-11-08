// Fills a multi-step form one step at a time and presses Next between steps, never Submit, stopping for the person at every defined stop sign.
import { describeFieldContext } from "../fields/fieldContext"
import { discoverFields } from "../fields/discoverFields"
import type { FieldReport } from "../fill/fillPage"
import { needsAttention } from "../fill/summary"
import { findNextButton } from "./nextButton"
import { detectStopSign } from "./stopSigns"

export type StepResult = { reports: FieldReport[]; notes: string[] }

export type FlowEndReason = "submit-reached" | "no-next" | "needs-you" | "captcha" | "login" | "stuck" | "limit" | "stopped" | "left-site"

export type FlowEnd = { reason: FlowEndReason; detail: string }

export type FlowStep = { number: number; reports: FieldReport[] }

export type FlowResult = { steps: FlowStep[]; notes: string[]; end: FlowEnd }

export type FlowDeps = {
  root: ParentNode
  fillStep: (stepNumber: number) => Promise<StepResult>
  click?: (element: HTMLElement) => void
  hostname?: () => string
  isStopped?: () => boolean
  beforeClick?: (stepNumber: number) => void | Promise<void>
  startAt?: number
  maxSteps?: number
  changeTimeoutMs?: number
  pollMs?: number
}

type Snapshot = { fields: ReadonlySet<HTMLElement>; heading: string; url: string }

export const DEFAULT_MAX_STEPS = 15
const DEFAULT_CHANGE_TIMEOUT_MS = 8000
const DEFAULT_POLL_MS = 150
const MAX_LISTED_FIELDS = 5

// Describes the page well enough to tell whether pressing Next changed it: its fields, first heading and address.
function snapshotOf(root: ParentNode): Snapshot {
  const heading = root.querySelector("h1, h2, h3, legend")?.textContent?.trim() ?? ""
  const url = typeof location === "undefined" ? "" : location.href
  return { fields: new Set(discoverFields(root).map((field) => field.element)), heading, url }
}

// Returns true when the page now differs from the snapshot.
function hasChanged(before: Snapshot, root: ParentNode): boolean {
  const now = snapshotOf(root)
  const sameFields = now.fields.size === before.fields.size && [...now.fields].every((element) => before.fields.has(element))
  return !sameFields || now.heading !== before.heading || now.url !== before.url
}

// Waits until the page differs from the snapshot, or the time runs out; returns whether it changed.
async function waitForChange(before: Snapshot, root: ParentNode, timeoutMs: number, pollMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    if (hasChanged(before, root)) return true
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return hasChanged(before, root)
}

// Returns the labels of required fields that the fill left for the person.
function requiredLeft(reports: readonly FieldReport[]): string[] {
  return reports
    .filter((report) => needsAttention(report) && describeFieldContext(report.field).required === true)
    .map((report) => report.field.label || report.field.name || "an unnamed field")
}

// Builds the end of a flow.
function ended(reason: FlowEndReason, detail: string): FlowEnd {
  return { reason, detail }
}

// Runs the steps: fill, check for stop signs, press Next, wait for the page to change, repeat.
export async function runSteps(deps: FlowDeps): Promise<FlowResult> {
  const { root } = deps
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS
  const click = deps.click ?? ((element: HTMLElement) => element.click())
  const startHost = deps.hostname?.()
  const steps: FlowStep[] = []
  const notes: string[] = []
  const finish = (end: FlowEnd): FlowResult => ({ steps, notes, end })

  for (let number = (deps.startAt ?? 0) + 1; ; number += 1) {
    if ((deps.startAt ?? 0) + steps.length >= maxSteps) return finish(ended("limit", `Stopped after ${maxSteps} steps.`))
    if (deps.isStopped?.()) return finish(ended("stopped", "You stopped it."))

    const sign = detectStopSign(root)
    if (sign) return finish(ended(sign.kind, sign.detail))

    const step = await deps.fillStep(number)
    steps.push({ number, reports: step.reports })
    notes.push(...step.notes)
    if (deps.isStopped?.()) return finish(ended("stopped", "You stopped it."))

    const left = requiredLeft(step.reports)
    if (left.length > 0) {
      return finish(ended("needs-you", `Fill these required fields yourself, then press Fill and continue again: ${left.slice(0, MAX_LISTED_FIELDS).join(", ")}.`))
    }

    const button = findNextButton(root)
    if (button.kind === "submit") return finish(ended("submit-reached", `Stopped before "${button.label}". Review the page and submit it yourself.`))
    if (button.kind === "none") return finish(ended("no-next", "No Next button found on this page."))

    const before = snapshotOf(root)
    await deps.beforeClick?.(number)
    click(button.element)
    const changed = await waitForChange(before, root, deps.changeTimeoutMs ?? DEFAULT_CHANGE_TIMEOUT_MS, deps.pollMs ?? DEFAULT_POLL_MS)
    if (!changed) return finish(ended("stuck", `Pressed "${button.label}" but the page did not change. Check it for an error.`))
    if (deps.hostname && deps.hostname() !== startHost) return finish(ended("left-site", "The page moved to another website, so it stopped."))
  }
}

// Finds the button or link that opens a job's application form (not the final Submit), and lists clickable things for the AI to choose from when the rules find none.
export type ApplyButtonResult = { kind: "apply"; element: HTMLElement; label: string } | { kind: "none" }

export type ApplyCandidate = { index: number; text: string; href?: string }

const CLICKABLE = "a, button, input[type='button'], input[type='submit'], [role='button']"
const APPLY = /^(apply|start (your |the |an )?application|apply (now|today|here|for|to))\b|\bapply (now|for this|to this)\b/i
const NOT_APPLY = /\b(filters?|coupon|applied|reapply|with (linkedin|indeed|google|seek|facebook|apple|github)|submit|save|share|alert|saved)\b/i
const NOT_CANDIDATE = /\b(submit|sign ?in|log ?in|register|create (an )?account|subscribe)\b/i
const MAX_LABEL_CHARS = 80
const MAX_CANDIDATES = 40

// Returns the words a clickable element shows: its text, else its value, aria-label or title.
function labelOf(element: HTMLElement): string {
  const text = element.textContent ?? ""
  const raw = text.trim() || element.getAttribute("value") || element.getAttribute("aria-label") || element.getAttribute("title") || ""
  return raw.replace(/\s+/g, " ").trim()
}

// Returns true when the user could see and press the element.
function isPressable(element: HTMLElement): boolean {
  if ((element as HTMLButtonElement).disabled || element.getAttribute("aria-disabled") === "true") return false
  if (element.closest("[hidden]") || element.closest("[aria-hidden='true']")) return false
  return !(typeof element.checkVisibility === "function" && !element.checkVisibility({ checkVisibilityCSS: true }))
}

// Returns true for a submit input that sits in a form with fields: that is the final submit, never an opener.
function isFormSubmit(element: HTMLElement): boolean {
  const isSubmit = (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) && element.type === "submit"
  const fields = element.closest("form")?.querySelector("input:not([type='submit']):not([type='hidden']), select, textarea")
  return isSubmit && Boolean(fields)
}

// Lists the pressable clickable elements that are not a form's submit, with their labels.
function pressable(root: ParentNode): { element: HTMLElement; label: string }[] {
  return Array.from(root.querySelectorAll<HTMLElement>(CLICKABLE))
    .filter((element) => isPressable(element) && !isFormSubmit(element))
    .map((element) => ({ element, label: labelOf(element) }))
    .filter((entry) => entry.label !== "")
}

// Finds the first button or link on the page that opens the application.
export function findApplyButton(root: ParentNode): ApplyButtonResult {
  const found = pressable(root).find((entry) => APPLY.test(entry.label) && !NOT_APPLY.test(entry.label))
  return found ? { kind: "apply", element: found.element, label: found.label } : { kind: "none" }
}

// Returns true when a label is short enough to show the AI and is not about submitting, signing in or signing up.
function isCandidate(label: string): boolean {
  return label.length <= MAX_LABEL_CHARS && !NOT_CANDIDATE.test(label)
}

// Lists clickable things with short labels, numbered, so the AI can say which one opens the application; submit-like ones are left out.
export function applyCandidates(root: ParentNode): ApplyCandidate[] {
  return pressable(root)
    .filter((entry) => isCandidate(entry.label))
    .slice(0, MAX_CANDIDATES)
    .map((entry, index) => {
      const href = entry.element.getAttribute("href")
      return href ? { index, text: entry.label, href } : { index, text: entry.label }
    })
}

// Returns the element that a candidate number from applyCandidates stands for.
export function candidateElement(root: ParentNode, index: number): HTMLElement | undefined {
  return pressable(root)
    .filter((entry) => isCandidate(entry.label))
    .slice(0, MAX_CANDIDATES)[index]?.element
}

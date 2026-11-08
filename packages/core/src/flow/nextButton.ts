// Finds the button that moves a multi-step form on, and recognises anything that could submit it, which must never be clicked.
export type NextButtonResult =
  | { kind: "next"; element: HTMLElement; label: string }
  | { kind: "submit"; label: string }
  | { kind: "none" }

type Candidate = { element: HTMLElement; label: string; isSubmitInput: boolean }

const BUTTONS = "button, input[type='submit'], input[type='button'], [role='button']"
const IGNORED = /\b(back|previous|prev|cancel|later|draft|skip|guest|sign in|log in|login|register|create account)\b/i
const SUBMIT = /\b(submit|apply|send|finish|complete|confirm|done|place)\b/i
const NEXT = /^(save\s*(and|&)\s*)?(next|continue|proceed)\b/i

// Returns the words a button shows: its text, else its value, aria-label or title, with spacing collapsed.
function labelOf(element: HTMLElement): string {
  const text = element.textContent ?? ""
  const raw = text.trim() || element.getAttribute("value") || element.getAttribute("aria-label") || element.getAttribute("title") || ""
  return raw.replace(/\s+/g, " ").trim()
}

// Returns true when the user could press the button: not disabled, not hidden, and drawn when the browser can say.
function isPressable(element: HTMLElement): boolean {
  if ((element as HTMLButtonElement).disabled || element.getAttribute("aria-disabled") === "true") return false
  if (element.closest("[hidden]") || element.closest("[aria-hidden='true']")) return false
  return !(typeof element.checkVisibility === "function" && !element.checkVisibility({ checkVisibilityCSS: true }))
}

// Lists the buttons on the page the user could press, with their labels, leaving out the ones for going back or leaving.
function candidates(root: ParentNode): Candidate[] {
  return Array.from(root.querySelectorAll<HTMLElement>(BUTTONS))
    .filter(isPressable)
    .map((element) => ({
      element,
      label: labelOf(element),
      isSubmitInput: element instanceof HTMLInputElement && element.type === "submit",
    }))
    .filter((candidate) => candidate.label !== "" && !IGNORED.test(candidate.label))
}

// Returns true when pressing the button could send the application.
function couldSubmit(candidate: Candidate): boolean {
  return candidate.isSubmitInput || SUBMIT.test(candidate.label)
}

// Finds the Next button on the page; if anything on it could submit the form, says so instead, so the caller stops.
export function findNextButton(root: ParentNode): NextButtonResult {
  const buttons = candidates(root)
  const submit = buttons.find(couldSubmit)
  if (submit) return { kind: "submit", label: submit.label }

  const next = buttons.find((candidate) => NEXT.test(candidate.label))
  return next ? { kind: "next", element: next.element, label: next.label } : { kind: "none" }
}

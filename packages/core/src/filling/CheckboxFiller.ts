// Fills checkboxes from Yes/No values by clicking them, and never unchecks a box that is already checked.
import type { FormField } from "../fields/types"
import type { Filler, FillResult } from "./types"

const YES_VALUES = new Set(["yes", "true", "y"])
const NO_VALUES = new Set(["no", "false", "n"])

// Returns true when the element is a checkbox.
function isCheckbox(element: HTMLElement): element is HTMLInputElement {
  return element.localName === "input" && (element as HTMLInputElement).type === "checkbox"
}

// Reads Yes/No style text as a boolean, or undefined when it is neither.
function parseYesNo(value: string): boolean | undefined {
  const text = value.trim().toLowerCase()
  if (YES_VALUES.has(text)) return true
  if (NO_VALUES.has(text)) return false
  return undefined
}

export class CheckboxFiller implements Filler {
  // Accepts fields whose kind is checkbox.
  canFill(field: FormField): boolean {
    return field.kind === "checkbox"
  }

  // Checks the box for Yes, leaves it for No, and skips a box that is already checked when asked for No.
  fill(field: FormField, value: string): FillResult {
    const checkbox = field.element
    if (!isCheckbox(checkbox)) return { status: "failed", reason: "Field is not a checkbox" }
    if (checkbox.disabled) return { status: "skipped", reason: "Field is disabled" }

    const wanted = parseYesNo(value)
    if (wanted === undefined) return { status: "failed", reason: "Checkbox needs a Yes or No value" }

    if (checkbox.checked === wanted) return { status: "filled" }
    if (checkbox.checked) return { status: "skipped", reason: "Field already has a value" }

    checkbox.click()
    return checkbox.checked
      ? { status: "filled" }
      : { status: "failed", reason: "The page did not accept the value" }
  }
}

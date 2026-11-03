// Fills a group of checkboxes (one multiple-choice question) by ticking the box whose label matches the value.
import { labelFor } from "../fields/labels"
import { checkboxesInGroup } from "../fields/checkboxGroup"
import type { FormField } from "../fields/types"
import { findChoice } from "./findChoice"
import type { Filler, FillResult } from "./types"

// Returns true when the element is a checkbox.
function isCheckbox(element: HTMLElement): element is HTMLInputElement {
  return element.localName === "input" && (element as HTMLInputElement).type === "checkbox"
}

export class CheckboxGroupFiller implements Filler {
  // Accepts fields whose kind is checkbox-group.
  canFill(field: FormField): boolean {
    return field.kind === "checkbox-group"
  }

  // Ticks the matching box unless a different box is already ticked, then checks the page accepted it.
  fill(field: FormField, value: string): FillResult {
    const first = field.element
    if (!isCheckbox(first)) return { status: "failed", reason: "Field is not a checkbox" }

    const group = checkboxesInGroup(first, first.ownerDocument)
    const target = findChoice(value, group, (checkbox) => labelFor(checkbox))
    if (!target) return { status: "failed", reason: `No single option matches "${value}"`, code: "no-option-match" }

    if (target.checked) return { status: "filled" }
    if (group.some((checkbox) => checkbox.checked)) return { status: "skipped", reason: "Field already has a value" }
    if (target.disabled) return { status: "failed", reason: "Option is disabled" }

    target.click()
    return target.checked
      ? { status: "filled" }
      : { status: "failed", reason: "The page did not accept the value" }
  }
}

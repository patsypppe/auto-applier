// Fills dropdown fields by picking the option whose text matches the value.
import { cleanText } from "../fields/labels"
import type { FormField } from "../fields/types"
import { fireChangeEvents } from "./events"
import { findChoice } from "./findChoice"
import type { Filler, FillResult } from "./types"

// Returns true when the element is a select.
function isSelect(element: HTMLElement): element is HTMLSelectElement {
  return element.localName === "select"
}

// Returns the options a user could pick, leaving out the empty placeholder.
function pickableOptions(select: HTMLSelectElement): HTMLOptionElement[] {
  return Array.from(select.options).filter((option) => option.value !== "")
}

// Returns true when the select shows a real choice, not a placeholder or an untouched first option.
function hasChosenValue(select: HTMLSelectElement): boolean {
  const selected = select.options[select.selectedIndex]
  if (!selected || selected.value === "") return false
  return select.selectedIndex !== 0 || selected.defaultSelected
}

export class SelectFiller implements Filler {
  // Accepts fields whose kind is select.
  canFill(field: FormField): boolean {
    return field.kind === "select"
  }

  // Selects the matching option unless the field is locked or already has a different choice, then checks it took.
  fill(field: FormField, value: string): FillResult {
    const select = field.element
    if (!isSelect(select)) return { status: "failed", reason: "Field is not a dropdown" }
    if (select.disabled) return { status: "skipped", reason: "Field is disabled" }

    const target = findChoice(value, pickableOptions(select), (option) => cleanText(option.textContent))
    if (!target) return { status: "failed", reason: `No single option matches "${value}"` }

    if (hasChosenValue(select)) {
      return select.selectedIndex === target.index
        ? { status: "filled" }
        : { status: "skipped", reason: "Field already has a value" }
    }
    if (target.disabled) return { status: "failed", reason: "Option is disabled" }

    select.selectedIndex = target.index
    fireChangeEvents(select)
    return select.selectedIndex === target.index
      ? { status: "filled" }
      : { status: "failed", reason: "The page did not accept the value" }
  }
}

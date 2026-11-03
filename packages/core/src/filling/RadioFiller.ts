// Fills radio groups by clicking the radio whose label matches the value.
import { labelFor } from "../fields/labels"
import { radiosInGroup } from "../fields/radioGroup"
import type { FormField } from "../fields/types"
import { findChoice } from "./findChoice"
import type { Filler, FillResult } from "./types"

// Returns true when the element is a radio button.
function isRadio(element: HTMLElement): element is HTMLInputElement {
  return element.localName === "input" && (element as HTMLInputElement).type === "radio"
}

export class RadioFiller implements Filler {
  // Accepts fields whose kind is radio.
  canFill(field: FormField): boolean {
    return field.kind === "radio"
  }

  // Clicks the matching radio unless the group already has a different one checked, then checks it took.
  fill(field: FormField, value: string): FillResult {
    const first = field.element
    if (!isRadio(first)) return { status: "failed", reason: "Field is not a radio button" }

    const group = radiosInGroup(first, first.ownerDocument)
    const target = findChoice(value, group, (radio) => labelFor(radio))
    if (!target) return { status: "failed", reason: `No single option matches "${value}"`, code: "no-option-match" }

    const checked = group.find((radio) => radio.checked)
    if (checked) {
      return checked === target
        ? { status: "filled" }
        : { status: "skipped", reason: "Field already has a value" }
    }
    if (target.disabled) return { status: "failed", reason: "Option is disabled" }

    target.click()
    return target.checked
      ? { status: "filled" }
      : { status: "failed", reason: "The page did not accept the value" }
  }
}

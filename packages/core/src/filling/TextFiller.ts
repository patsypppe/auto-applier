// Fills plain text fields (text, email, phone, textarea) and checks the page accepted the value.
import type { FormField } from "../fields/types"
import { setNativeValue } from "./setNativeValue"
import type { Filler, FillResult } from "./types"

type TextControl = HTMLInputElement | HTMLTextAreaElement

// Returns true when the element is an input or a textarea.
function isTextControl(element: HTMLElement): element is TextControl {
  return element.localName === "input" || element.localName === "textarea"
}

export class TextFiller implements Filler {
  // Accepts fields whose kind is plain text.
  canFill(field: FormField): boolean {
    return field.kind === "text"
  }

  // Types the value in, unless the field is locked or already holds a different value, then reads it back to check.
  fill(field: FormField, value: string): FillResult {
    const element = field.element
    if (!isTextControl(element)) return { status: "failed", reason: "Field is not a text input" }
    if (element.readOnly || element.disabled) {
      return { status: "skipped", reason: "Field is read-only or disabled" }
    }
    if (element.value === value) return { status: "filled" }
    if (element.value !== "") return { status: "skipped", reason: "Field already has a value" }

    setNativeValue(element, value)
    return element.value === value
      ? { status: "filled" }
      : { status: "failed", reason: "The page did not accept the value" }
  }
}

// Scans a page or element for fillable form controls and describes each one as a FormField.
import { cleanText, groupLabel, labelFor } from "./labels"
import type { FieldKind, FormField } from "./types"

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const SKIPPED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "password"])
const DISTINCT_INPUT_KINDS = new Set(["radio", "checkbox", "file", "date"])

// Returns the kind of a control, or undefined when it should not be filled.
function kindOf(control: Control): FieldKind | undefined {
  if (control.disabled) return undefined
  if (control instanceof HTMLSelectElement) return "select"
  if (control instanceof HTMLTextAreaElement) return "text"
  if (SKIPPED_INPUT_TYPES.has(control.type)) return undefined
  if (control.getAttribute("role") === "combobox") return "combobox"
  if (DISTINCT_INPUT_KINDS.has(control.type)) return control.type as FieldKind
  return "text"
}

// Returns the visible choices of a select, skipping the empty placeholder option.
function selectOptions(select: HTMLSelectElement): string[] {
  return Array.from(select.options)
    .filter((option) => option.value !== "")
    .map((option) => cleanText(option.textContent))
    .filter((text) => text !== "")
}

// Returns every radio that belongs to the same group (same name and form) as the given radio.
function radiosInGroup(radio: HTMLInputElement, root: ParentNode): HTMLInputElement[] {
  if (radio.name === "") return [radio]

  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
    (other) => other.name === radio.name && other.form === radio.form,
  )
}

// Describes a radio group as one field built from its first radio; the other radios return undefined.
function describeRadioGroup(radio: HTMLInputElement, root: ParentNode): FormField | undefined {
  const group = radiosInGroup(radio, root)
  if (group[0] !== radio) return undefined

  return {
    element: radio,
    kind: "radio",
    label: groupLabel(radio),
    name: radio.name,
    options: group.map((member) => labelFor(member)),
    groupId: radio.name || undefined,
  }
}

// Describes one control as a FormField, or returns undefined when it should be skipped.
function describeControl(control: Control, root: ParentNode): FormField | undefined {
  const kind = kindOf(control)
  if (!kind) return undefined
  if (kind === "radio") return describeRadioGroup(control as HTMLInputElement, root)

  return {
    element: control,
    kind,
    label: labelFor(control),
    name: control.name || control.id,
    options: control instanceof HTMLSelectElement ? selectOptions(control) : [],
  }
}

// Finds every fillable control inside the root, in page order, as a list of FormFields.
export function discoverFields(root: ParentNode): FormField[] {
  const controls = Array.from(root.querySelectorAll<Control>("input, select, textarea"))
  return controls.flatMap((control) => describeControl(control, root) ?? [])
}

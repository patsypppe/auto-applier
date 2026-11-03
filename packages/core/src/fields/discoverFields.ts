// Scans a page or element for fillable form controls and describes each one as a FormField.
import { checkboxesInGroup } from "./checkboxGroup"
import { cleanText, groupLabel, labelFor } from "./labels"
import { radiosInGroup } from "./radioGroup"
import type { FieldKind, FormField } from "./types"

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const SKIPPED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "password", "search"])
const DISTINCT_INPUT_KINDS = new Set(["radio", "checkbox", "file", "date"])
const KINDS_THAT_MUST_BE_VISIBLE = new Set<FieldKind>(["text", "select", "combobox"])
const INCIDENTAL_LANDMARKS = "footer, nav, header, [role='contentinfo'], [role='navigation'], [role='banner'], [role='search']"
const SIGNUP_WORDS = /newsletter|subscri(be|ption)/i
const SIGNUP_SEARCH_DEPTH = 6

// Returns true when the browser says the control is not drawn (display none and the like); false when it cannot say, as in tests.
function isNotRendered(control: Control): boolean {
  return typeof control.checkVisibility === "function" && !control.checkVisibility({ checkVisibilityCSS: true })
}

// Returns true for controls that are part of the page rather than the application: in a footer, menu or search area, or a newsletter signup.
function isIncidental(control: Control): boolean {
  if (control.closest(INCIDENTAL_LANDMARKS)) return true
  if (SIGNUP_WORDS.test(control.name)) return true

  let node: Element | null = control
  for (let depth = 0; node && depth < SIGNUP_SEARCH_DEPTH; depth += 1) {
    if (SIGNUP_WORDS.test(`${node.id} ${node.getAttribute("class") ?? ""}`)) return true
    node = node.parentElement
  }
  return false
}

// Returns the kind of a control, or undefined when it should not be filled.
function kindOf(control: Control): FieldKind | undefined {
  if (control.disabled || control.getAttribute("aria-hidden") === "true") return undefined
  if (control instanceof HTMLInputElement && SKIPPED_INPUT_TYPES.has(control.type)) return undefined
  if (isIncidental(control)) return undefined

  const kind = plainKindOf(control)
  return KINDS_THAT_MUST_BE_VISIBLE.has(kind) && isNotRendered(control) ? undefined : kind
}

// Returns the kind a control has, before any decision about whether it should be filled.
function plainKindOf(control: Control): FieldKind {
  if (control instanceof HTMLSelectElement) return "select"
  if (control instanceof HTMLTextAreaElement) return "text"
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

// Describes checkboxes that share a name as one field built from the first enabled one, or a lone checkbox as a single field.
function describeCheckbox(checkbox: HTMLInputElement, root: ParentNode): FormField | undefined {
  const group = checkboxesInGroup(checkbox, root).filter((member) => !member.disabled)
  if (group.length < 2) return describeSingle(checkbox, "checkbox")
  if (group[0] !== checkbox) return undefined

  return {
    element: checkbox,
    kind: "checkbox-group",
    label: groupLabel(checkbox),
    name: checkbox.name,
    options: group.map((member) => labelFor(member)),
    groupId: checkbox.name,
  }
}

// Describes one control that is a field by itself.
function describeSingle(control: Control, kind: FieldKind): FormField {
  return {
    element: control,
    kind,
    label: labelFor(control),
    name: control.name || control.id,
    options: control instanceof HTMLSelectElement ? selectOptions(control) : [],
  }
}

// Describes one control as a FormField, or returns undefined when it should be skipped.
function describeControl(control: Control, root: ParentNode): FormField | undefined {
  const kind = kindOf(control)
  if (!kind) return undefined
  if (kind === "radio") return describeRadioGroup(control as HTMLInputElement, root)
  if (kind === "checkbox") return describeCheckbox(control as HTMLInputElement, root)

  return describeSingle(control, kind)
}

// Finds every fillable control inside the root, in page order, as a list of FormFields.
export function discoverFields(root: ParentNode): FormField[] {
  const controls = Array.from(root.querySelectorAll<Control>("input, select, textarea"))
  return controls.flatMap((control) => describeControl(control, root) ?? [])
}

// Defines how a form field found on a page is represented.
export type FieldKind =
  | "text"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "combobox"
  | "date"

export type FormField = {
  element: HTMLElement
  kind: FieldKind
  label: string
  name: string
  options: string[]
  groupId?: string
}

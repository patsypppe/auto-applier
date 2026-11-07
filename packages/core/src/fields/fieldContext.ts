// Reads what surrounds a field on the page (its section, help text, limits and error) so the model can answer it with more than a label.
import { cleanText } from "./labels"
import type { FormField } from "./types"

export type FieldContext = {
  section?: string
  help?: string
  placeholder?: string
  required?: boolean
  inputType?: string
  maxLength?: number
  error?: string
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const MAX_TEXT_CHARS = 200
const HEADINGS = "h1, h2, h3, h4, h5, h6, [role='heading']"
const MAX_ANCESTOR_STEPS = 8

// Cuts text to a length that cannot swamp the prompt.
function shortened(text: string): string {
  return text.slice(0, MAX_TEXT_CHARS)
}

// Returns the text of the elements an attribute such as aria-describedby points to.
function referencedText(element: Element, attribute: string): string {
  const ids = element.getAttribute(attribute)?.split(/\s+/).filter((id) => id !== "") ?? []
  const texts = ids.map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
  return shortened(cleanText(texts.join(" ")))
}

// Returns the last heading found in an element or the element itself, or undefined.
function lastHeadingIn(element: Element): string | undefined {
  const headings = element.matches(HEADINGS) ? [element] : Array.from(element.querySelectorAll(HEADINGS))
  const text = cleanText(headings[headings.length - 1]?.textContent)
  return text === "" ? undefined : shortened(text)
}

// Returns the fieldset legend that holds the element, if any.
function legendOf(element: Element): string | undefined {
  const text = cleanText(element.closest("fieldset")?.querySelector("legend")?.textContent)
  return text === "" ? undefined : shortened(text)
}

// Returns the nearest heading above the element, looking at earlier siblings of the element and of its ancestors.
function headingAbove(element: Element): string | undefined {
  let node: Element | null = element
  for (let step = 0; node && node !== node.ownerDocument.body && step < MAX_ANCESTOR_STEPS; step += 1) {
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      const heading = lastHeadingIn(sibling)
      if (heading) return heading
    }
    node = node.parentElement
  }
  return undefined
}

// Returns the section a field sits in: its fieldset legend, else the nearest heading above it, unless that only repeats the label.
function sectionOf(field: FormField): string | undefined {
  const section = legendOf(field.element) ?? headingAbove(field.element)
  return section === undefined || section === field.label ? undefined : section
}

// Returns the error text of a control the page marked invalid, from aria-errormessage or the text that describes it.
function errorOf(control: Element): string | undefined {
  if (control.getAttribute("aria-invalid") !== "true") return undefined

  const text = referencedText(control, "aria-errormessage") || referencedText(control, "aria-describedby")
  return text === "" ? undefined : text
}

// Returns the length limit of a control, or undefined when it has none.
function maxLengthOf(control: Control): number | undefined {
  const { maxLength } = control as HTMLInputElement
  return typeof maxLength === "number" && maxLength > 0 ? maxLength : undefined
}

// Returns the type of an input when it says something more than plain text (email, tel, url, number).
function inputTypeOf(control: Control): string | undefined {
  return control instanceof HTMLInputElement && control.type !== "text" && control.type !== "" ? control.type : undefined
}

// Returns true when the page requires the control to be filled.
function isRequired(control: Control): boolean {
  return control.required || control.getAttribute("aria-required") === "true"
}

// Describes the surroundings of a field; every part that the page does not give is left out.
export function describeFieldContext(field: FormField): FieldContext {
  const control = field.element as Control
  const error = errorOf(control)
  const help = error ? "" : referencedText(control, "aria-describedby")
  const placeholder = cleanText(control.getAttribute("placeholder"))
  const entries: [keyof FieldContext, string | number | boolean | undefined][] = [
    ["section", sectionOf(field)],
    ["help", help === "" ? undefined : help],
    ["placeholder", placeholder === "" || placeholder === field.label ? undefined : shortened(placeholder)],
    ["required", isRequired(control) ? true : undefined],
    ["inputType", inputTypeOf(control)],
    ["maxLength", maxLengthOf(control)],
    ["error", error],
  ]
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as FieldContext
}

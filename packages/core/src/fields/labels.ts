// Works out the human-readable label of a form control from the ways pages label things.
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const CONTROL_SELECTOR = "input, select, textarea, button"

// Collapses whitespace and drops a trailing required-marker asterisk.
export function cleanText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().replace(/\s*\*+$/, "")
}

// Returns a label's text without the text of any form controls nested inside it.
function textWithoutControls(label: Element): string {
  const copy = label.cloneNode(true) as Element
  copy.querySelectorAll(CONTROL_SELECTOR).forEach((control) => control.remove())
  return cleanText(copy.textContent)
}

// Reads the text of the elements an aria-labelledby attribute points to.
function labelledByText(element: Element): string {
  const ids = element.getAttribute("aria-labelledby")?.split(/\s+/) ?? []
  const texts = ids.map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
  return cleanText(texts.join(" "))
}

// Reads the text of the label elements attached to a control, by "for" or by wrapping.
function labelElementsText(control: Control): string {
  return Array.from(control.labels ?? [])
    .map(textWithoutControls)
    .join(" ")
    .trim()
}

// Returns the label of a control, trying aria-labelledby, label elements, aria-label, then placeholder.
export function labelFor(control: Control): string {
  return (
    labelledByText(control) ||
    labelElementsText(control) ||
    cleanText(control.getAttribute("aria-label")) ||
    cleanText(control.getAttribute("placeholder"))
  )
}

// Returns the question text of a radio or checkbox group, taken from its fieldset legend or group label.
export function groupLabel(input: HTMLInputElement): string {
  const group = input.closest("fieldset, [role='radiogroup'], [role='group']")
  if (!group) return ""

  return (
    labelledByText(group) ||
    cleanText(group.getAttribute("aria-label")) ||
    cleanText(group.querySelector("legend")?.textContent)
  )
}

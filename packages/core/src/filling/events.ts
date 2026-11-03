// Fires the events that make a page notice a field was changed, and the full set of events a real mouse click produces.

// Dispatches bubbling input and change events on the element.
export function fireChangeEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

// Returns the middle of the element, which is where a real click reports its pointer position.
function centerOf(element: HTMLElement): { clientX: number; clientY: number } {
  const rect = element.getBoundingClientRect()
  return { clientX: Math.round(rect.left + rect.width / 2), clientY: Math.round(rect.top + rect.height / 2) }
}

// Builds a pointer event, or a mouse event of the same name in browsers that have no pointer events.
function pointerEvent(type: string, init: PointerEventInit): Event {
  return typeof PointerEvent === "function" ? new PointerEvent(type, init) : new MouseEvent(type, init)
}

// Returns true for the elements a real click moves the keyboard focus to.
function isFormControl(element: HTMLElement): boolean {
  return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
}

// Dispatches pointerdown, mousedown, (focus), pointerup, mouseup and click with a position, the left button and the pressed state, as a real click does.
export function clickLikeUser(element: HTMLElement): void {
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    detail: 1,
    ...centerOf(element),
  }
  const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true }

  element.dispatchEvent(pointerEvent("pointerdown", { ...base, ...pointer, buttons: 1 }))
  element.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }))
  if (isFormControl(element)) element.focus()
  element.dispatchEvent(pointerEvent("pointerup", { ...base, ...pointer, buttons: 0 }))
  element.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }))
  element.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }))
}

// Fires the events that make a page notice a field was changed.

// Dispatches bubbling input and change events on the element.
export function fireChangeEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

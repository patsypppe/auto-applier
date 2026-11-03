// Sets a text control's value in a way frameworks like React notice, then fires the events they listen to.
type TextControl = HTMLInputElement | HTMLTextAreaElement

// Writes the value through the browser's own setter, skipping any override the page put on the element, and fires input and change.
export function setNativeValue(element: TextControl, value: string): void {
  const prototype = element.localName === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

  if (nativeSetter) nativeSetter.call(element, value)
  else element.value = value

  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

// Finds the checkboxes that belong together as one multiple-choice question on a page.

// Returns every checkbox with the same name and form as the given one, or just that checkbox when it has no name.
export function checkboxesInGroup(checkbox: HTMLInputElement, root: ParentNode): HTMLInputElement[] {
  if (checkbox.name === "") return [checkbox]

  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter(
    (other) => other.name === checkbox.name && other.form === checkbox.form,
  )
}

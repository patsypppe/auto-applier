// Finds the radios that belong together as one group on a page.

// Returns every radio that belongs to the same group (same name and form) as the given radio.
export function radiosInGroup(radio: HTMLInputElement, root: ParentNode): HTMLInputElement[] {
  if (radio.name === "") return [radio]

  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
    (other) => other.name === radio.name && other.form === radio.form,
  )
}

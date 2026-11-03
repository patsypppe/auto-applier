// Renders the editable profile form into the popup, saves it through a ProfileStore, and lets other code fill it in.
import { carriedOverOf, emptyFormValues, fromFormValues, toFormValues } from "@auto-applier/core"
import type { CarriedOver, Profile, ProfileFormValues, ProfileStore } from "@auto-applier/core"
import { PROFILE_FIELDS } from "./profileFields"
import type { FieldSpec } from "./profileFields"

export type ProfileFormHandle = {
  getValues(): ProfileFormValues
  getCarried(): CarriedOver | undefined
  showProfile(profile: Profile): void
  showDraft(values: ProfileFormValues, carried: CarriedOver, errors: string[]): void
}

// Creates the input control for one field: a yes/no select or a text-like input.
function createControl(spec: FieldSpec, value: string): HTMLInputElement | HTMLSelectElement {
  if (spec.type === "yesno") {
    const select = document.createElement("select")
    select.append(new Option("No", "no"), new Option("Yes", "yes"))
    select.value = value
    return select
  }

  const input = document.createElement("input")
  input.type = spec.type
  input.value = value
  input.required = spec.required === true
  return input
}

// Creates a label and its control for one field.
function createField(spec: FieldSpec, value: string): HTMLElement {
  const control = createControl(spec, value)
  control.id = spec.key
  control.name = spec.key

  const label = document.createElement("label")
  label.htmlFor = spec.key
  label.textContent = spec.label

  const wrapper = document.createElement("div")
  wrapper.className = "field"
  wrapper.append(label, control)
  return wrapper
}

// Reads the current value of every field in the form.
function readValues(form: HTMLFormElement): ProfileFormValues {
  const data = new FormData(form)
  return PROFILE_FIELDS.reduce(
    (values, spec) => ({ ...values, [spec.key]: String(data.get(spec.key) ?? "") }),
    emptyFormValues(),
  )
}

// Puts the given values into the form's fields.
function writeValues(form: HTMLFormElement, values: ProfileFormValues): void {
  for (const spec of PROFILE_FIELDS) {
    const control = form.elements.namedItem(spec.key) as HTMLInputElement | HTMLSelectElement | null
    if (control) control.value = values[spec.key]
  }
}

// Replaces the contents of a list element with one item per message.
function showMessages(list: HTMLElement, messages: string[]): void {
  const items = messages.map((message) => {
    const item = document.createElement("li")
    item.textContent = message
    return item
  })
  list.replaceChildren(...items)
}

// Loads the saved profile into a form inside the container, saves it when submitted, and returns a handle to drive it.
export async function mountProfileForm(container: HTMLElement, store: ProfileStore): Promise<ProfileFormHandle> {
  const saved = await store.load()
  let carried: CarriedOver | undefined = saved ? carriedOverOf(saved) : undefined
  const values = saved ? toFormValues(saved) : emptyFormValues()

  const errors = document.createElement("ul")
  errors.className = "errors"
  errors.setAttribute("role", "alert")

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  const submit = document.createElement("button")
  submit.type = "submit"
  submit.textContent = "Save profile"

  const form = document.createElement("form")
  form.noValidate = true
  form.append(...PROFILE_FIELDS.map((spec) => createField(spec, values[spec.key])), errors, submit, status)

  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    status.textContent = ""

    const result = fromFormValues(readValues(form), carried)
    if (!result.ok) {
      showMessages(errors, result.errors)
      return
    }

    try {
      await store.save(result.profile)
      carried = carriedOverOf(result.profile)
      showMessages(errors, [])
      status.textContent = "Saved."
    } catch (error: unknown) {
      showMessages(errors, [error instanceof Error ? error.message : "Could not save the profile."])
    }
  })

  container.replaceChildren(form)

  return {
    getValues: () => readValues(form),
    getCarried: () => carried,
    showProfile(profile) {
      writeValues(form, toFormValues(profile))
      carried = carriedOverOf(profile)
      showMessages(errors, [])
      status.textContent = ""
    },
    showDraft(draftValues, draftCarried, problems) {
      writeValues(form, draftValues)
      carried = draftCarried
      showMessages(errors, problems)
      status.textContent = ""
    },
  }
}

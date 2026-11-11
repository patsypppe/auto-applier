// Builds the settings panel on the feed page: work authorization, roles, levels, places, dates, years and degree. It sends
// what the user chose, with the saved settings it does not show kept as they are, and shows the server's mistakes.
import { CLEARANCES, LEVELS, STATUSES } from "../feed/filterValues"
import { DEGREES } from "../matching/degree"
import type { FeedSettings } from "../settings"
import type { Degree, WorkAuth, WorkAuthStatus } from "../types"

export type SettingsDraft = {
  workAuth: Partial<Omit<WorkAuth, "status">> & { status: WorkAuthStatus | "" }
  filters: Partial<FeedSettings["filters"]> & Record<string, unknown>
}

export const ROLE_GROUPS: readonly [string, readonly string[]][] = [
  ["Data and analytics", ["data analyst", "data scientist", "data engineer", "business analyst", "business intelligence analyst", "analytics engineer"]],
  ["Machine learning and AI", ["machine learning engineer", "ai engineer", "research scientist", "applied scientist"]],
  ["Software", ["software engineer", "backend engineer", "frontend engineer", "full stack engineer"]],
  ["Statistics and quantitative", ["statistician", "biostatistician", "quantitative analyst"]],
]

const STATUS_LABELS: Record<WorkAuthStatus, string> = {
  citizen: "U.S. citizen",
  "permanent-resident": "Permanent resident",
  "f1-cpt": "F-1 on CPT",
  "f1-opt": "F-1 on OPT",
  "f1-stem-opt": "F-1 on STEM OPT",
  h1b: "H-1B",
  "other-needs-sponsorship": "Other, needs sponsorship",
}

const CLEARANCE_LABELS: Record<WorkAuth["clearance"], string> = { none: "none", "can-obtain": "can obtain one", active: "active" }

// Makes an element with an optional class and text.
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag)
  if (className) made.className = className
  if (text !== undefined) made.textContent = text
  return made
}

// Makes a labelled menu with the given values and labels, set to the chosen value.
function menu(name: string, label: string, options: readonly [string, string][], value: string): HTMLLabelElement {
  const wrapper = element("label", undefined, `${label} `)
  const select = element("select")
  select.name = name
  for (const [option, text] of options) {
    const item = element("option", undefined, text)
    item.value = option
    select.append(item)
  }
  select.value = value
  wrapper.append(select)
  return wrapper
}

// Makes a labelled input of the given type, such as a checkbox, a number or a line of text.
function input(name: string, label: string, type: string, value: string | boolean, inputValue?: string): HTMLLabelElement {
  const field = element("input")
  field.name = name
  field.type = type
  if (inputValue !== undefined) field.value = inputValue
  if (typeof value === "boolean") field.checked = value
  else field.value = value
  const wrapper = element("label")
  if (type === "checkbox") wrapper.append(field, ` ${label}`)
  else wrapper.append(`${label} `, field)
  return wrapper
}

// Groups fields under a heading.
function section(title: string, ...fields: HTMLElement[]): HTMLFieldSetElement {
  const set = element("fieldset")
  set.append(element("legend", undefined, title), ...fields)
  return set
}

// Splits comma-separated text into trimmed, non-empty items.
function items(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
}

// Reads the form into settings to send, keeping the saved settings the form does not show. Empty number boxes and "not
// set" leave the value out, so the server uses its default.
function readForm(form: HTMLFormElement, saved: FeedSettings | undefined): SettingsDraft {
  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value
  const checked = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).checked
  const ticked = (name: string) => [...form.querySelectorAll<HTMLInputElement>(`input[name='${name}']:checked`)].map((box) => box.value)
  const number = (name: string) => (value(name).trim() === "" ? undefined : Number(value(name)))

  const roles = [...new Set([...ticked("role"), ...items(value("otherRoles"))])]
  const filters: SettingsDraft["filters"] = {
    ...saved?.filters,
    roles,
    levels: LEVELS.filter((level) => ticked("level").includes(level)),
    locations: items(value("locations")),
    remoteOnly: checked("remoteOnly"),
    postedWithinDays: number("postedWithinDays"),
    maxYearsRequired: number("maxYearsRequired"),
    myDegree: (value("myDegree") || undefined) as Degree | undefined,
  }
  for (const key of Object.keys(filters)) if (filters[key] === undefined) delete filters[key]

  return {
    workAuth: {
      ...saved?.workAuth,
      status: value("status") as WorkAuthStatus | "",
      needsSponsorshipLater: checked("needsSponsorshipLater"),
      stemDegree: checked("stemDegree"),
      clearance: value("clearance") as WorkAuth["clearance"],
    },
    filters,
  }
}

// Builds the form from the saved settings, or empty for a first setup, and calls onSave with the choices on submit.
// onSave answers with the server's mistakes, one per line, or undefined when the settings were saved.
export function renderSettingsForm(saved: FeedSettings | undefined, onSave: (draft: SettingsDraft) => Promise<string | undefined>): HTMLFormElement {
  const form = element("form", "settings")
  const work = saved?.workAuth
  const filters = saved?.filters
  const listed = new Set(ROLE_GROUPS.flatMap(([, roles]) => roles))
  const roles = filters?.roles ?? []

  form.append(
    section(
      "Work authorization",
      menu("status", "Status", [["", "Choose one"], ...STATUSES.map((status): [string, string] => [status, STATUS_LABELS[status]])], work?.status ?? ""),
      input("needsSponsorshipLater", "I will need sponsorship later", "checkbox", work?.needsSponsorshipLater ?? false),
      input("stemDegree", "My degree is in a STEM field", "checkbox", work?.stemDegree ?? false),
      menu("clearance", "Security clearance", CLEARANCES.map((name): [string, string] => [name, CLEARANCE_LABELS[name]]), work?.clearance ?? "none"),
    ),
  )

  const roleFields = ROLE_GROUPS.map(([group, names]) => {
    const row = element("div", "role-group")
    row.append(element("strong", undefined, `${group}: `))
    for (const name of names) row.append(input("role", name, "checkbox", roles.includes(name), name))
    return row
  })
  const other = roles.filter((role) => !listed.has(role)).join(", ")
  form.append(section("Roles", ...roleFields, input("otherRoles", "Other roles, separated by commas", "text", other)))

  const levels = element("div")
  for (const level of LEVELS) levels.append(input("level", level.replace("-", " "), "checkbox", filters?.levels.includes(level) ?? false, level))
  form.append(
    section(
      "What to show",
      levels,
      input("locations", "Places, separated by commas (empty for anywhere in the US)", "text", (filters?.locations ?? []).join(", ")),
      input("remoteOnly", "Remote only", "checkbox", filters?.remoteOnly ?? false),
      input("postedWithinDays", "Posted within (days)", "number", filters ? String(filters.postedWithinDays) : ""),
      input("maxYearsRequired", "Most years of experience asked", "number", filters ? String(filters.maxYearsRequired) : ""),
      menu("myDegree", "My highest degree", [["", "not set"], ...DEGREES.map((degree): [string, string] => [degree, degree])], filters?.myDegree ?? ""),
    ),
  )

  const errors = element("p", "errors")
  const button = element("button", undefined, "Save settings")
  button.type = "submit"
  form.append(button, errors)

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    button.disabled = true
    void onSave(readForm(form, saved))
      .catch(() => "The settings could not be saved.")
      .then((problems) => {
        errors.textContent = problems ?? ""
        button.disabled = false
      })
  })
  return form
}

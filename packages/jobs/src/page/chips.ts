// Builds the row of filter chips over the cards: toggles for workplace, job type and level, menus for date, years, pay
// and degree, and the page's own "new since last visit" and "E-Verify only". Each change is reported as the values to
// send in the feed's address, plus the page's own choices.
import { JOB_TYPES, LEVELS, WORKPLACES } from "../feed/filterValues"
import type { Degree, JobType, Level, Workplace } from "../types"

export type ChipFilters = {
  readonly postedWithinDays: number
  readonly workplaces: readonly Workplace[]
  readonly jobTypes: readonly JobType[]
  readonly levels: readonly Level[]
  readonly maxYearsRequired: number
  readonly minYearlyPay: number
  readonly myDegree?: Degree
}

export const CHIP_NAMES = ["within", "workplace", "jobType", "level", "maxYears", "minPay", "degree", "newOnly", "eVerifyOnly"] as const

export type ChipChoices = Record<(typeof CHIP_NAMES)[number], string>

export type PageChips = { readonly newOnly: boolean; readonly eVerifyOnly: boolean; readonly stemOpt: boolean }

export const PAGE_ONLY: readonly (keyof ChipChoices)[] = ["newOnly", "eVerifyOnly"]

// The chips for values the settings panel also saves: posted within, levels, years asked and degree.
const PANEL_CHIPS: readonly (keyof ChipChoices)[] = ["within", "level", "maxYears", "degree"]

// Returns the stored chips without the ones the settings panel also sets, so a settings save is not overridden by an
// older chip choice.
export function withoutPanelChips(chips: Partial<ChipChoices>): Partial<ChipChoices> {
  return Object.fromEntries(Object.entries(chips).filter(([name]) => !PANEL_CHIPS.includes(name as keyof ChipChoices)))
}

const MENUS: readonly [keyof ChipChoices, string, readonly [string, string][]][] = [
  ["within", "Posted", [["7", "in the last 7 days"], ["30", "in the last 30 days"], ["90", "in the last 90 days"]]],
  ["maxYears", "Years asked", [["0", "none"], ["1", "up to 1"], ["2", "up to 2"], ["3", "up to 3"], ["5", "up to 5"], ["10", "up to 10"]]],
  ["minPay", "Pay", [["0", "any or not stated"], ["60000", "$60k+ a year"], ["80000", "$80k+ a year"], ["100000", "$100k+ a year"], ["120000", "$120k+ a year"], ["150000", "$150k+ a year"]]],
  ["degree", "Degree", [["any", "any"], ["associate", "up to associate's"], ["bachelor", "up to bachelor's"], ["master", "up to master's"], ["phd", "up to PhD"]]],
]

const TOGGLES: readonly [keyof ChipChoices, string, readonly string[]][] = [
  ["workplace", "Workplace", WORKPLACES],
  ["jobType", "Job type", JOB_TYPES],
  ["level", "Level", LEVELS],
]

// Writes a list as the address value: comma-separated, or "any" when empty.
function listValue(items: readonly string[]): string {
  return items.length > 0 ? items.join(",") : "any"
}

// Returns the address values for the filters the server used and the page's own choices.
export function choicesFrom(used: ChipFilters, page: Omit<PageChips, "stemOpt">): ChipChoices {
  return {
    within: String(used.postedWithinDays),
    workplace: listValue(used.workplaces),
    jobType: listValue(used.jobTypes),
    level: listValue(used.levels),
    maxYears: String(used.maxYearsRequired),
    minPay: String(used.minYearlyPay),
    degree: used.myDegree ?? "any",
    newOnly: String(page.newOnly),
    eVerifyOnly: String(page.eVerifyOnly),
  }
}

// Makes a labelled menu whose options include the value in use, even when it is not one of the usual ones.
function menu(name: keyof ChipChoices, label: string, options: readonly [string, string][], value: string, onPick: (value: string) => void): HTMLElement {
  const wrapper = document.createElement("label")
  wrapper.append(`${label} `)
  const select = document.createElement("select")
  select.name = name
  const all = options.some(([option]) => option === value) ? options : [...options, [value, value] as [string, string]]
  for (const [option, text] of all) {
    const item = document.createElement("option")
    item.value = option
    item.textContent = text
    select.append(item)
  }
  select.value = value
  select.addEventListener("change", () => onPick(select.value))
  wrapper.append(select)
  return wrapper
}

// Makes a chip that is pressed or not and reports a click.
function chip(group: string, value: string, label: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "chip"
  button.dataset.group = group
  button.dataset.value = value
  button.textContent = label
  button.setAttribute("aria-pressed", String(pressed))
  button.addEventListener("click", onClick)
  return button
}

// Builds the chips row for the filters in use and calls onChange with every value after each change. "E-Verify only" is
// offered only to a user the STEM OPT rule applies to.
export function renderChips(used: ChipFilters, page: PageChips, onChange: (choices: ChipChoices) => void): HTMLElement {
  const choices = choicesFrom(used, page)
  const row = document.createElement("div")
  row.className = "chips"
  const report = (name: keyof ChipChoices, value: string) => onChange({ ...choices, [name]: value })

  for (const [name, label, options] of MENUS) row.append(menu(name, label, options, choices[name], (value) => report(name, value)))

  for (const [name, label, values] of TOGGLES) {
    const group = document.createElement("span")
    group.className = "chip-group"
    group.append(`${label}: `)
    const chosen = choices[name] === "any" ? [] : choices[name].split(",")
    for (const value of values) {
      const next = chosen.includes(value) ? chosen.filter((item) => item !== value) : [...chosen, value]
      group.append(chip(name, value, value.replace("-", " "), chosen.includes(value), () => report(name, listValue(values.filter((item) => next.includes(item))))))
    }
    row.append(group)
  }

  row.append(chip("newOnly", "new", "new since last visit", page.newOnly, () => report("newOnly", String(!page.newOnly))))
  if (page.stemOpt) row.append(chip("eVerifyOnly", "e-verify", "E-Verify only", page.eVerifyOnly, () => report("eVerifyOnly", String(!page.eVerifyOnly))))
  return row
}

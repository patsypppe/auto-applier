// Fills custom dropdowns (inputs with the combobox role) by typing the value, waiting for the options and clicking the match.
import { cleanText } from "../fields/labels"
import type { FormField } from "../fields/types"
import { clickLikeUser } from "./events"
import { findChoice } from "./findChoice"
import type { OptionReader } from "./OptionReader"
import { setNativeValue } from "./setNativeValue"
import type { FailureCode, Filler, FillResult } from "./types"
import { waitUntil } from "./waitUntil"
import type { WaitTiming } from "./waitUntil"

const DEFAULT_TIMING: WaitTiming = { timeoutMs: 1500, pollMs: 50 }
const SHOWN_CHOICE_SEARCH_DEPTH = 3

// Returns true when the element is an input.
function isInput(element: HTMLElement): element is HTMLInputElement {
  return element.localName === "input"
}

// Returns the ids of the lists an element says it controls or owns.
function listIds(element: Element): string[] {
  const ids = `${element.getAttribute("aria-controls") ?? ""} ${element.getAttribute("aria-owns") ?? ""}`
  return ids.split(/\s+/).filter((id) => id !== "")
}

// Returns the option elements of this combobox's own list; before it announces one, only visible options that no other combobox owns.
function findOptions(input: HTMLInputElement): HTMLElement[] {
  const doc = input.ownerDocument
  const [ownId] = listIds(input)
  if (ownId) {
    const list = doc.getElementById(ownId)
    return list ? Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')) : []
  }

  const owned = new Set(
    Array.from(doc.querySelectorAll('[role="combobox"]')).filter((other) => other !== input).flatMap(listIds),
  )
  return Array.from(doc.querySelectorAll<HTMLElement>('[role="option"]')).filter((option) => {
    const list = option.closest('[role="listbox"]')
    return !option.closest("[hidden]") && !(list && owned.has(list.id))
  })
}

// Returns an option's text without a trailing dial code, so "United States+1" reads as "United States".
function optionText(option: HTMLElement): string {
  return cleanText(option.textContent).replace(/\s*\+\d+$/, "")
}

// Returns the choice a dropdown already displays next to its input (React-select shows it outside the input, which stays empty), or "".
function shownChoice(input: HTMLInputElement): string {
  let container = input.parentElement
  for (let depth = 0; container && depth < SHOWN_CHOICE_SEARCH_DEPTH; depth += 1) {
    const shown = container.querySelector('[class*="single-value"], [class*="singleValue"]')
    if (shown) return cleanText(shown.textContent)
    container = container.parentElement
  }
  return ""
}

// Returns true once the pick has visibly taken effect: the option is gone, or its list is closed or hidden.
function pickTookEffect(input: HTMLInputElement, option: HTMLElement): boolean {
  const listbox = option.closest('[role="listbox"]')
  return (
    !option.isConnected ||
    input.getAttribute("aria-expanded") === "false" ||
    (listbox?.hasAttribute("hidden") ?? false)
  )
}

// Clears the text we typed so the field is left as we found it, and reports the failure.
function giveUp(input: HTMLInputElement, reason: string, code?: FailureCode): FillResult {
  setNativeValue(input, "")
  return { status: "failed", reason, code }
}

export class ComboboxFiller implements Filler, OptionReader {
  private readonly timing: WaitTiming

  constructor(timing: Partial<WaitTiming> = {}) {
    this.timing = { ...DEFAULT_TIMING, ...timing }
  }

  // Accepts fields whose kind is combobox.
  canFill(field: FormField): boolean {
    return field.kind === "combobox"
  }

  // Opens the list without typing, returns its option texts, and closes it again; returns nothing for a locked or already-filled field or a list that stays empty.
  async readOptions(field: FormField): Promise<string[]> {
    const input = field.element
    if (!isInput(input) || input.readOnly || input.disabled || shownChoice(input) !== "") return []

    input.focus()
    if (input.getAttribute("aria-expanded") !== "true") clickLikeUser(input)
    const appeared = await waitUntil(() => findOptions(input).length > 0, this.timing)
    const texts = appeared ? findOptions(input).map(optionText).filter((text) => text !== "") : []
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    return [...new Set(texts)]
  }

  // Opens the list with a full click if it is closed, types the value to filter it, clicks the matching option, and checks the list reacted.
  async fill(field: FormField, value: string): Promise<FillResult> {
    const input = field.element
    if (!isInput(input)) return { status: "failed", reason: "Field is not a combobox input" }
    if (input.readOnly || input.disabled) {
      return { status: "skipped", reason: "Field is read-only or disabled" }
    }
    const shown = shownChoice(input)
    if (shown !== "") {
      return findChoice(value, [shown], (text) => text)
        ? { status: "filled" }
        : { status: "skipped", reason: "Field already has a value" }
    }
    if (input.value === value) return { status: "filled" }
    if (input.value !== "") return { status: "skipped", reason: "Field already has a value" }

    input.focus()
    if (input.getAttribute("aria-expanded") !== "true") clickLikeUser(input)
    setNativeValue(input, value)

    const appeared = await waitUntil(() => findOptions(input).length > 0, this.timing)
    if (!appeared) return giveUp(input, "No options appeared", "no-options")

    const target = findChoice(value, findOptions(input), optionText)
    if (!target) return giveUp(input, `No single option matches "${value}"`, "no-option-match")
    if (target.getAttribute("aria-disabled") === "true") return giveUp(input, "Option is disabled")

    clickLikeUser(target)
    const accepted = await waitUntil(() => pickTookEffect(input, target), this.timing)
    return accepted
      ? { status: "filled" }
      : { status: "failed", reason: "Could not confirm the page accepted the choice" }
  }
}

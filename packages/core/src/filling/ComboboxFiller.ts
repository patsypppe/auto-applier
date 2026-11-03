// Fills custom dropdowns (inputs with the combobox role) by typing the value, waiting for the options and clicking the match.
import { cleanText } from "../fields/labels"
import type { FormField } from "../fields/types"
import { clickLikeUser } from "./events"
import { findChoice } from "./findChoice"
import { setNativeValue } from "./setNativeValue"
import type { FailureCode, Filler, FillResult } from "./types"
import { waitUntil } from "./waitUntil"
import type { WaitTiming } from "./waitUntil"

const DEFAULT_TIMING: WaitTiming = { timeoutMs: 1500, pollMs: 50 }

// Returns true when the element is an input.
function isInput(element: HTMLElement): element is HTMLInputElement {
  return element.localName === "input"
}

// Returns the option elements in the list this combobox controls, or none if that list is not on the page yet.
function findOptions(input: HTMLInputElement): HTMLElement[] {
  const listboxId = (input.getAttribute("aria-controls") ?? input.getAttribute("aria-owns") ?? "").split(/\s+/)[0]
  const scope: ParentNode | null = listboxId ? input.ownerDocument.getElementById(listboxId) : input.ownerDocument
  return scope ? Array.from(scope.querySelectorAll<HTMLElement>('[role="option"]')) : []
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

export class ComboboxFiller implements Filler {
  private readonly timing: WaitTiming

  constructor(timing: Partial<WaitTiming> = {}) {
    this.timing = { ...DEFAULT_TIMING, ...timing }
  }

  // Accepts fields whose kind is combobox.
  canFill(field: FormField): boolean {
    return field.kind === "combobox"
  }

  // Types the value to open and filter the list, clicks the matching option, and checks the list reacted.
  async fill(field: FormField, value: string): Promise<FillResult> {
    const input = field.element
    if (!isInput(input)) return { status: "failed", reason: "Field is not a combobox input" }
    if (input.readOnly || input.disabled) {
      return { status: "skipped", reason: "Field is read-only or disabled" }
    }
    if (input.value === value) return { status: "filled" }
    if (input.value !== "") return { status: "skipped", reason: "Field already has a value" }

    input.focus()
    setNativeValue(input, value)

    const appeared = await waitUntil(() => findOptions(input).length > 0, this.timing)
    if (!appeared) return giveUp(input, "No options appeared")

    const target = findChoice(value, findOptions(input), (option) => cleanText(option.textContent))
    if (!target) return giveUp(input, `No single option matches "${value}"`, "no-option-match")
    if (target.getAttribute("aria-disabled") === "true") return giveUp(input, "Option is disabled")

    clickLikeUser(target)
    const accepted = await waitUntil(() => pickTookEffect(input, target), this.timing)
    return accepted
      ? { status: "filled" }
      : { status: "failed", reason: "Could not confirm the page accepted the choice" }
  }
}

// Tests that ComboboxFiller types into a custom dropdown, waits for its options and clicks the right one.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import { fieldForElement } from "../testing/fieldFromHtml"
import { makeField } from "../testing/makeField"
import { ComboboxFiller } from "./ComboboxFiller"

const filler = new ComboboxFiller({ timeoutMs: 150, pollMs: 5 })

type FakeOptions = {
  delayMs?: number
  filter?: boolean
  pickWorks?: boolean
  disabled?: string[]
}

// Builds a fake custom dropdown: typing shows options after a delay, clicking one chooses it and closes the list.
function buildCombobox(optionTexts: string[], settings: FakeOptions = {}) {
  const { delayMs = 10, filter = true, pickWorks = true, disabled = [] } = settings
  document.body.innerHTML = `
    <label for="c">School</label>
    <input id="c" role="combobox" aria-controls="lb" aria-expanded="false" />
    <div id="lb" role="listbox"></div>`

  const input = document.getElementById("c") as HTMLInputElement
  const listbox = document.getElementById("lb") as HTMLElement
  const state = { chosen: "", clicks: [] as string[] }

  // Creates one option element wired to record clicks and, if the pick works, choose and close.
  function makeOption(text: string): HTMLElement {
    const option = document.createElement("div")
    option.setAttribute("role", "option")
    option.textContent = text
    if (disabled.includes(text)) option.setAttribute("aria-disabled", "true")
    for (const type of ["mousedown", "mouseup", "click"]) {
      option.addEventListener(type, () => state.clicks.push(type))
    }
    option.addEventListener("click", () => {
      if (!pickWorks) return
      state.chosen = text
      listbox.replaceChildren()
      input.setAttribute("aria-expanded", "false")
    })
    return option
  }

  input.addEventListener("input", () => {
    setTimeout(() => {
      const shown = optionTexts.filter((text) => !filter || text.toLowerCase().includes(input.value.toLowerCase()))
      listbox.replaceChildren(...shown.map(makeOption))
      input.setAttribute("aria-expanded", "true")
    }, delayMs)
  })

  return { input, field: fieldForElement(input, "combobox"), state }
}

describe("ComboboxFiller: canFill", () => {
  test("accepts combobox fields only", () => {
    expect(filler.canFill(makeField({ kind: "combobox" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "select" }))).toBe(false)
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(false)
  })
})

describe("ComboboxFiller: fill", () => {
  test("types the value, waits for the options and picks the match", async () => {
    const { field, state } = buildCombobox(["Harvard University", "United States Naval Academy"])

    const result = await filler.fill(field, "Harvard University")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("Harvard University")
  })

  test("picks a longer option that starts with the value", async () => {
    const { field, state } = buildCombobox(["Yes, I am authorized", "No, I am not"])

    await filler.fill(field, "Yes")

    expect(state.chosen).toBe("Yes, I am authorized")
  })

  test("clicks the option with mousedown, mouseup and click in that order", async () => {
    const { field, state } = buildCombobox(["Canada", "Mexico"])

    await filler.fill(field, "Canada")

    expect(state.clicks).toEqual(["mousedown", "mouseup", "click"])
  })

  test("waits for options that arrive late", async () => {
    const { field, state } = buildCombobox(["Canada"], { delayMs: 60 })

    const result = await filler.fill(field, "Canada")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("Canada")
  })

  test("fails and clears what it typed when no options ever appear", async () => {
    const { field, input } = buildCombobox(["Canada", "Mexico"])

    const result = await filler.fill(field, "Zzz")

    expect(result).toEqual({ status: "failed", reason: "No options appeared" })
    expect(input.value).toBe("")
  })

  test("fails and clears what it typed when options appear but none match", async () => {
    const { field, input } = buildCombobox(["Canada", "Mexico"], { filter: false })

    const result = await filler.fill(field, "United States")

    expect(result).toEqual({
      status: "failed",
      reason: 'No single option matches "United States"',
      code: "no-option-match",
    })
    expect(input.value).toBe("")
  })

  test("fails rather than guess when two options fit", async () => {
    const { field, state } = buildCombobox(["Yes, with sponsorship", "Yes, without sponsorship"], { filter: false })

    const result = await filler.fill(field, "Yes")

    expect(result.status).toBe("failed")
    expect(state.chosen).toBe("")
  })

  test("fails when the matching option is disabled", async () => {
    const { field, state } = buildCombobox(["Open", "Closed (full)"], { disabled: ["Closed (full)"] })

    const result = await filler.fill(field, "Closed")

    expect(result).toEqual({ status: "failed", reason: "Option is disabled" })
    expect(state.chosen).toBe("")
  })

  test("fails when the page does not react to the pick", async () => {
    const { field } = buildCombobox(["Canada"], { pickWorks: false })

    const result = await filler.fill(field, "Canada")

    expect(result).toEqual({ status: "failed", reason: "Could not confirm the page accepted the choice" })
  })

  test("skips when the input already holds different text", async () => {
    const { field, input, state } = buildCombobox(["Canada"])
    input.value = "Harvard"

    const result = await filler.fill(field, "Canada")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(input.value).toBe("Harvard")
    expect(state.chosen).toBe("")
  })

  test("counts an input that already holds the value as filled", async () => {
    const { field, input } = buildCombobox(["Canada"])
    input.value = "Canada"

    expect(await filler.fill(field, "Canada")).toEqual({ status: "filled" })
  })

  test("skips a read-only or disabled input", async () => {
    const { field, input } = buildCombobox(["Canada"])
    input.disabled = true

    expect(await filler.fill(field, "Canada")).toEqual({
      status: "skipped",
      reason: "Field is read-only or disabled",
    })
  })

  test("fails when the element is not an input", async () => {
    const field = fieldForElement(document.createElement("div"), "combobox")

    expect(await filler.fill(field, "Canada")).toEqual({
      status: "failed",
      reason: "Field is not a combobox input",
    })
  })
})

describe("ComboboxFiller: finding the right list of options", () => {
  const PHONE_LIST = `<ul id="phone-list" role="listbox"><li role="option">United States+1</li><li role="option">Canada+1</li></ul>`

  // Builds a page with a phone country picker (whose list is always on the page) and a dropdown that announces its list only after typing.
  function buildDropdownBesidePhonePicker() {
    document.body.innerHTML = `
      <input id="phone-country" role="combobox" aria-controls="phone-list" aria-expanded="false" />
      ${PHONE_LIST}
      <label for="q">Authorized to work?</label>
      <input id="q" role="combobox" aria-expanded="false" />
      <div id="area"></div>`

    const input = document.getElementById("q") as HTMLInputElement
    const state = { chosen: "" }
    input.addEventListener("input", () => {
      setTimeout(() => {
        const list = document.createElement("div")
        list.id = "q-list"
        list.setAttribute("role", "listbox")
        for (const text of ["Yes", "No"]) {
          const option = document.createElement("div")
          option.setAttribute("role", "option")
          option.textContent = text
          option.addEventListener("click", () => {
            state.chosen = text
            list.remove()
            input.setAttribute("aria-expanded", "false")
          })
          list.append(option)
        }
        document.getElementById("area")!.append(list)
        input.setAttribute("aria-controls", "q-list")
        input.setAttribute("aria-expanded", "true")
      }, 30)
    })
    return { input, field: fieldForElement(input, "combobox"), state }
  }

  test("does not read another dropdown's always-present list while its own has not appeared", async () => {
    const { field, state } = buildDropdownBesidePhonePicker()

    const result = await filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("Yes")
  })

  test("fails with no options, not a wrong match, when the only options belong to another dropdown", async () => {
    document.body.innerHTML = `
      <input id="phone-country" role="combobox" aria-controls="phone-list" />
      ${PHONE_LIST}
      <input id="q" role="combobox" />`
    const field = fieldForElement(document.getElementById("q") as HTMLInputElement, "combobox")

    const result = await filler.fill(field, "Yes")

    expect(result).toMatchObject({ status: "failed", reason: "No options appeared" })
  })

  test("ignores options inside a hidden container", async () => {
    document.body.innerHTML = `
      <input id="q" role="combobox" />
      <div hidden><div role="option">Yes</div></div>`
    const field = fieldForElement(document.getElementById("q") as HTMLInputElement, "combobox")

    const result = await filler.fill(field, "Yes")

    expect(result).toMatchObject({ status: "failed", reason: "No options appeared" })
  })
})

describe("ComboboxFiller: options that end in a dial code", () => {
  test("matches a country to the option that shows it with its dial code", async () => {
    const { field, state } = buildCombobox(["Canada+1", "United States Minor Outlying Islands+1", "United States+1"])

    const result = await filler.fill(field, "United States")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("United States+1")
  })

  test("still fails rather than guess when only longer names fit", async () => {
    const { field } = buildCombobox(["United States Minor Outlying Islands+1", "United States Virgin Islands+1"])

    const result = await filler.fill(field, "United States")

    expect(result).toMatchObject({ status: "failed", code: "no-option-match" })
  })
})

describe("ComboboxFiller: dropdowns that only open for a full click", () => {
  // Builds a dropdown like React-select: typing alone does nothing, a full click opens the list, and typing then filters it.
  function buildClickToOpenCombobox(optionTexts: string[], settings: { alreadyOpen?: boolean } = {}) {
    document.body.innerHTML = `
      <div class="shell"><input id="c" role="combobox" aria-expanded="false" /></div>
      <div class="shell2" id="area"></div>`
    const input = document.getElementById("c") as HTMLInputElement
    const area = document.getElementById("area") as HTMLElement
    const state = { chosen: "", clicksOnInput: 0, open: false }

    // Shows the options that contain the typed text, announcing the list like an open dropdown does.
    function render(): void {
      const list = document.createElement("div")
      list.id = "c-list"
      list.setAttribute("role", "listbox")
      for (const text of optionTexts.filter((candidate) => candidate.toLowerCase().includes(input.value.toLowerCase()))) {
        const option = document.createElement("div")
        option.setAttribute("role", "option")
        option.textContent = text
        option.addEventListener("click", () => {
          state.chosen = text
          state.open = false
          area.replaceChildren()
          input.setAttribute("aria-expanded", "false")
        })
        list.append(option)
      }
      area.replaceChildren(list)
      input.setAttribute("aria-controls", "c-list")
      input.setAttribute("aria-expanded", "true")
    }

    const sequence: string[] = []
    input.addEventListener("pointerdown", () => sequence.push("pointerdown"))
    input.addEventListener("mousedown", () => sequence.push("mousedown"))
    input.addEventListener("mouseup", () => sequence.push("mouseup"))
    input.addEventListener("click", () => {
      state.clicksOnInput += 1
      if (sequence.join() === "pointerdown,mousedown,mouseup" && !state.open) {
        state.open = true
        render()
      }
    })
    input.addEventListener("input", () => {
      if (state.open) render()
    })

    if (settings.alreadyOpen) {
      state.open = true
      render()
    }
    return { input, field: fieldForElement(input, "combobox"), state }
  }

  test("opens the list with a full click before typing, then picks the option", async () => {
    const { field, state } = buildClickToOpenCombobox(["Yes", "No"])

    const result = await filler.fill(field, "Yes")

    expect(result).toEqual({ status: "filled" })
    expect(state.chosen).toBe("Yes")
  })

  test("does not click a dropdown that is already open", async () => {
    const { field, state } = buildClickToOpenCombobox(["Yes", "No"], { alreadyOpen: true })

    await filler.fill(field, "No")

    expect(state.clicksOnInput).toBe(0)
    expect(state.chosen).toBe("No")
  })
})

describe("ComboboxFiller: a choice the dropdown already shows", () => {
  test("skips a dropdown that already displays a chosen value, even though its input is empty", async () => {
    document.body.innerHTML = `
      <div class="select-shell">
        <div class="select__single-value">No</div>
        <input id="c" role="combobox" aria-expanded="false" />
      </div>`
    const field = fieldForElement(document.getElementById("c") as HTMLInputElement, "combobox")

    const result = await filler.fill(field, "Yes")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
  })

  test("counts a dropdown that already shows the wanted value as filled", async () => {
    document.body.innerHTML = `
      <div class="select-shell">
        <div class="css-abc-singleValue">United States</div>
        <input id="c" role="combobox" aria-expanded="false" />
      </div>`
    const field = fieldForElement(document.getElementById("c") as HTMLInputElement, "combobox")

    expect(await filler.fill(field, "United States")).toEqual({ status: "filled" })
  })

  test("treats a dropdown that only shows a placeholder as empty", async () => {
    document.body.innerHTML = `
      <div class="select-shell">
        <div class="select__placeholder">Select...</div>
        <input id="c" role="combobox" aria-expanded="false" />
      </div>`
    const field = fieldForElement(document.getElementById("c") as HTMLInputElement, "combobox")

    const result = await filler.fill(field, "Yes")

    expect(result).toMatchObject({ status: "failed", reason: "No options appeared" })
  })
})

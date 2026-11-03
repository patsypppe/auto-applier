// Tests that TextFiller fills text fields, and skips or fails safely when it should not or cannot.
// @vitest-environment jsdom
import { describe, expect, test } from "vitest"
import type { FormField } from "../fields/types"
import { makeField } from "../testing/makeField"
import { TextFiller } from "./TextFiller"

const filler = new TextFiller()

// Builds a text field around the given element.
function fieldFor(element: HTMLElement): FormField {
  return { element, kind: "text", label: "", name: "", options: [] }
}

describe("TextFiller: canFill", () => {
  test("accepts text fields", () => {
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(true)
  })

  test.each(["select", "radio", "checkbox", "file", "combobox", "date"] as const)(
    "does not accept %s fields",
    (kind) => {
      expect(filler.canFill(makeField({ kind }))).toBe(false)
    },
  )
})

describe("TextFiller: fill", () => {
  test("fills an empty input", () => {
    const field = makeField()

    const result = filler.fill(field, "Pranav")

    expect(result).toEqual({ status: "filled" })
    expect((field.element as HTMLInputElement).value).toBe("Pranav")
  })

  test("fills a textarea", () => {
    const textarea = document.createElement("textarea")

    const result = filler.fill(fieldFor(textarea), "A longer answer")

    expect(result).toEqual({ status: "filled" })
    expect(textarea.value).toBe("A longer answer")
  })

  test("fires input and change events so the page notices", () => {
    const field = makeField()
    const events: string[] = []
    field.element.addEventListener("input", () => events.push("input"))
    field.element.addEventListener("change", () => events.push("change"))

    filler.fill(field, "Pranav")

    expect(events).toEqual(["input", "change"])
  })

  test("leaves a different existing value alone and says why", () => {
    const field = makeField()
    const input = field.element as HTMLInputElement
    input.value = "typed by the user"

    const result = filler.fill(field, "Pranav")

    expect(result).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(input.value).toBe("typed by the user")
  })

  test("counts an existing identical value as filled without firing events", () => {
    const field = makeField()
    const input = field.element as HTMLInputElement
    input.value = "Pranav"
    const events: string[] = []
    input.addEventListener("input", () => events.push("input"))

    const result = filler.fill(field, "Pranav")

    expect(result).toEqual({ status: "filled" })
    expect(events).toEqual([])
  })

  test("skips a read-only field", () => {
    const field = makeField()
    const input = field.element as HTMLInputElement
    input.readOnly = true

    const result = filler.fill(field, "Pranav")

    expect(result).toEqual({ status: "skipped", reason: "Field is read-only or disabled" })
    expect(input.value).toBe("")
  })

  test("skips a disabled field", () => {
    const field = makeField()
    const input = field.element as HTMLInputElement
    input.disabled = true

    const result = filler.fill(field, "Pranav")

    expect(result).toEqual({ status: "skipped", reason: "Field is read-only or disabled" })
  })

  test("fails when the page refuses the value", () => {
    const input = document.createElement("input")
    input.type = "number"

    const result = filler.fill(fieldFor(input), "not a number")

    expect(result).toEqual({ status: "failed", reason: "The page did not accept the value" })
  })

  test("fails when the element is not a text control", () => {
    const result = filler.fill(fieldFor(document.createElement("div")), "Pranav")

    expect(result).toEqual({ status: "failed", reason: "Field is not a text input" })
  })
})

describe("TextFiller: a page that reformats what was typed", () => {
  // Makes the field reformat its value after every input, as a phone-number widget does.
  function reformatTo(field: FormField, shown: string): void {
    field.element.addEventListener("input", () => {
      ;(field.element as HTMLInputElement).value = shown
    })
  }

  test("counts a phone number the page showed with spaces and brackets as filled", () => {
    const field = makeField()
    reformatTo(field, "(555) 123-4567")

    expect(filler.fill(field, "5551234567")).toEqual({ status: "filled" })
  })

  test("counts a number the page showed without its country code as filled", () => {
    const field = makeField()
    reformatTo(field, "(555) 123-4567")

    expect(filler.fill(field, "+1 555 123 4567")).toEqual({ status: "filled" })
  })

  test("still fails when the page kept different digits", () => {
    const field = makeField()
    reformatTo(field, "(999) 888-7777")

    expect(filler.fill(field, "5551234567")).toEqual({ status: "failed", reason: "The page did not accept the value" })
  })

  test("does not treat short digit strings that merely end alike as the same", () => {
    const field = makeField()
    reformatTo(field, "2020")

    expect(filler.fill(field, "12020")).toMatchObject({ status: "failed" })
  })
})


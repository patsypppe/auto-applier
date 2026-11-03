// Tests that setNativeValue changes the value, fires the events frameworks listen to, and bypasses value overrides.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import { setNativeValue } from "./setNativeValue"

describe("setNativeValue", () => {
  test("sets the value of an input", () => {
    const input = document.createElement("input")

    setNativeValue(input, "Pranav")

    expect(input.value).toBe("Pranav")
  })

  test("sets the value of a textarea", () => {
    const textarea = document.createElement("textarea")

    setNativeValue(textarea, "Hello there")

    expect(textarea.value).toBe("Hello there")
  })

  test("fires input then change, and both bubble up to the page", () => {
    const input = document.createElement("input")
    document.body.append(input)
    const events: string[] = []
    document.addEventListener("input", () => events.push("input"))
    document.addEventListener("change", () => events.push("change"))

    setNativeValue(input, "x")

    expect(events).toEqual(["input", "change"])
  })

  test("goes around a value override on the element, like the one React installs", () => {
    const input = document.createElement("input")
    const overrideSetter = vi.fn()
    Object.defineProperty(input, "value", { get: () => "", set: overrideSetter, configurable: true })

    setNativeValue(input, "Pranav")

    const nativeGetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.get
    expect(nativeGetter?.call(input)).toBe("Pranav")
    expect(overrideSetter).not.toHaveBeenCalled()
  })

  test("replaces a value that is already there", () => {
    const input = document.createElement("input")
    input.value = "old"

    setNativeValue(input, "new")

    expect(input.value).toBe("new")
  })
})

// Tests that countryOf reads whether a job is in the United States from location text as job boards write it.
import { describe, expect, test } from "vitest"
import { countryOf } from "./country"

describe("countryOf: United States", () => {
  test.each([
    ["San Francisco, CA"],
    ["New York, NY"],
    ["Remote - US"],
    ["Remote (US)"],
    ["United States"],
    ["Costa Mesa, California, United States"],
    ["Washington, D.C."],
    ["Maryland"],
    ["Seattle, WA or Remote"],
    ["USA"],
  ])("reads %s as US", (location) => {
    expect(countryOf([location])).toBe("US")
  })

  test.each([["Atlanta GA"], ["St. Louis MO"], ["San Francisco"], ["Chicago"], ["Office - Chicago"], ["Austin"], ["NYC"]])(
    "reads %s, written without a comma or a state, as US",
    (location) => {
      expect(countryOf([location])).toBe("US")
    },
  )

  test("counts a job as US when any of its locations is in the US", () => {
    expect(countryOf(["London, United Kingdom", "New York, NY"])).toBe("US")
  })
})

describe("countryOf: other countries", () => {
  test.each([["Tokyo, Japan"], ["Remote - Japan"], ["Bengaluru, India"], ["Singapore"], ["Berlin, Germany"], ["Toronto, Canada"]])(
    "reads %s as another country",
    (location) => {
      expect(countryOf([location])).toBe("other")
    },
  )

  test.each([["Amsterdam"], ["Bengaluru"], ["Bangalore"], ["Tokyo"], ["Sydney"], ["Toronto, ON"], ["Berlin"], ["Home based - EMEA"]])(
    "reads the big city or region %s as another country",
    (location) => {
      expect(countryOf([location])).toBe("other")
    },
  )

  test("does not read a two-letter word inside another country's name as a state", () => {
    expect(countryOf(["Paris, France"])).toBe("other")
  })
})

describe("countryOf: not enough to tell", () => {
  test.each([["Dublin"], ["London"], ["Remote"], ["Hybrid"]])("leaves %s undecided", (location) => {
    expect(countryOf([location])).toBeUndefined()
  })

  test("leaves a job with no locations undecided", () => {
    expect(countryOf([])).toBeUndefined()
  })
})

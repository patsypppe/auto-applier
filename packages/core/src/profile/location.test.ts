// Tests that a profile's city, state and country are joined into one location text when any of them is set.
import { describe, expect, test } from "vitest"
import { locationText } from "./location"
import type { PersonalInfo } from "./types"

const base: PersonalInfo = {
  firstName: "Pranav",
  lastName: "Pattanashetty",
  email: "pranav@example.com",
  phone: "5551234567",
  links: {},
}

describe("locationText", () => {
  test("joins city, state and country with commas", () => {
    expect(locationText({ ...base, city: "Seattle", state: "WA", country: "United States" })).toBe(
      "Seattle, WA, United States",
    )
  })

  test("skips the parts that are not set", () => {
    expect(locationText({ ...base, city: "Seattle", country: "United States" })).toBe("Seattle, United States")
    expect(locationText({ ...base, country: "India" })).toBe("India")
  })

  test("returns undefined when none of the parts is set", () => {
    expect(locationText(base)).toBeUndefined()
  })
})

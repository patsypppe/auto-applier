import { describe, expect, test } from "vitest"
import { fullName, legalName, preferredName } from "./names"
import type { PersonalInfo } from "./types"

const base: PersonalInfo = {
  firstName: "Pranav",
  lastName: "Pattanashetty",
  email: "pranav@example.com",
  phone: "5551234567",
  links: {},
}

describe("fullName", () => {
  test("joins first and last name when there is no middle name", () => {
    expect(fullName(base)).toBe("Pranav Pattanashetty")
  })

  test("includes the middle name when present", () => {
    expect(fullName({ ...base, middleName: "T" })).toBe("Pranav T Pattanashetty")
  })
})

describe("legalName", () => {
  test("falls back to the full name when no override is set", () => {
    expect(legalName(base)).toBe("Pranav Pattanashetty")
  })

  test("uses the override when set", () => {
    expect(legalName({ ...base, legalName: "Pranav Tukaram Pattanashetty" })).toBe(
      "Pranav Tukaram Pattanashetty",
    )
  })
})

describe("preferredName", () => {
  test("falls back to the first name when no override is set", () => {
    expect(preferredName(base)).toBe("Pranav")
  })

  test("uses the override when set", () => {
    expect(preferredName({ ...base, preferredName: "Pran" })).toBe("Pran")
  })
})

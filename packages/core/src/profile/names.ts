import type { PersonalInfo } from "./types"

// Joins first, middle (if any) and last name into one string.
export function fullName(personal: PersonalInfo): string {
  return [personal.firstName, personal.middleName, personal.lastName]
    .filter((part) => part)
    .join(" ")
}

// Returns the legal name override, or the full name if none is set.
export function legalName(personal: PersonalInfo): string {
  return personal.legalName ?? fullName(personal)
}

// Returns the preferred name override, or the first name if none is set.
export function preferredName(personal: PersonalInfo): string {
  return personal.preferredName ?? personal.firstName
}

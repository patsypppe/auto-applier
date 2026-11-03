// Joins the city, state and country of a profile into one location text, for fields that ask for a single location.
import type { PersonalInfo } from "./types"

// Returns "City, State, Country" with the unset parts left out, or undefined when none is set.
export function locationText(personal: PersonalInfo): string | undefined {
  const parts = [personal.city, personal.state, personal.country].filter((part): part is string => !!part)
  return parts.length > 0 ? parts.join(", ") : undefined
}

// Tests that every profile key has a plain-language description for the LLM.
import { describe, expect, test } from "vitest"
import { PROFILE_KEY_HELP } from "./keyDescriptions"
import { PROFILE_KEYS } from "./keys"

describe("PROFILE_KEY_HELP", () => {
  test("describes every profile key with some text", () => {
    for (const key of PROFILE_KEYS) {
      expect(PROFILE_KEY_HELP[key].length, key).toBeGreaterThan(5)
    }
  })

  test("says which keys are yes or no answers", () => {
    expect(PROFILE_KEY_HELP.needsSponsorship).toMatch(/yes or no/i)
    expect(PROFILE_KEY_HELP.isAuthorizedToWork).toMatch(/yes or no/i)
  })
})

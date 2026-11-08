// Tests that the address of a known job board's application page is worked out from the posting's address.
import { describe, expect, test } from "vitest"
import { applyUrlFor } from "./applyUrl"

describe("applyUrlFor", () => {
  test("adds /apply to a Lever posting", () => {
    expect(applyUrlFor("https://jobs.lever.co/acme/0f4e1c2a-1111-2222-3333-444455556666")).toBe("https://jobs.lever.co/acme/0f4e1c2a-1111-2222-3333-444455556666/apply")
  })

  test("adds /application to an Ashby posting", () => {
    expect(applyUrlFor("https://jobs.ashbyhq.com/acme/0f4e1c2a-1111-2222-3333-444455556666")).toBe("https://jobs.ashbyhq.com/acme/0f4e1c2a-1111-2222-3333-444455556666/application")
  })

  test("keeps a query string out of the way and drops a trailing slash", () => {
    expect(applyUrlFor("https://jobs.lever.co/acme/abc/?lever-source=x")).toBe("https://jobs.lever.co/acme/abc/apply")
  })

  test("returns nothing when already on the application page", () => {
    expect(applyUrlFor("https://jobs.lever.co/acme/abc/apply")).toBeUndefined()
    expect(applyUrlFor("https://jobs.ashbyhq.com/acme/abc/application")).toBeUndefined()
  })

  test("returns nothing for a company list page, other sites and rubbish", () => {
    expect(applyUrlFor("https://jobs.lever.co/acme")).toBeUndefined()
    expect(applyUrlFor("https://example.com/jobs/1")).toBeUndefined()
    expect(applyUrlFor("not a url")).toBeUndefined()
  })
})

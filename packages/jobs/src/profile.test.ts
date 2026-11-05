// Tests that loadProfile reads a profile saved in the extension's shape and explains what is wrong with a bad one.
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "vitest"
import { loadProfile } from "./profile"

const PROFILE = {
  personal: { firstName: "Sam", lastName: "Rivera", email: "sam@example.com", phone: "5550100", links: {} },
  experience: [{ company: "Acme", title: "Data Intern", startDate: "2025-06", endDate: "2025-08", description: "Built dashboards" }],
  education: [{ school: "State University", degree: "MS", field: "Statistics", startDate: "2025-08" }],
  skills: ["Python", "SQL", "R"],
  answers: { workAuthorization: "F-1 OPT", needsSponsorship: true, isAuthorizedToWork: true },
}

let dir = ""

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "profile-"))
})

describe("loadProfile", () => {
  test("reads a profile in the same shape the extension saves", async () => {
    const file = join(dir, "profile.json")
    await writeFile(file, JSON.stringify(PROFILE))

    const profile = await loadProfile(file)

    expect(profile.skills).toEqual(["Python", "SQL", "R"])
    expect(profile.education[0]!.field).toBe("Statistics")
  })

  test("lists every problem in a bad profile, one per line", async () => {
    const file = join(dir, "profile.json")
    await writeFile(file, JSON.stringify({ ...PROFILE, personal: { ...PROFILE.personal, email: "not-an-email" }, skills: "Python" }))

    await expect(loadProfile(file)).rejects.toThrow(/^The profile in .*profile\.json has problems:\n  personal\.email: .+\n  skills: /)
  })

  test("says how to create the profile when there is none", async () => {
    const file = join(dir, "profile.json")

    await expect(loadProfile(file)).rejects.toThrow(
      `No profile at ${file}. Copy data.example/profile.example.json to data/profile.json and fill it in.`,
    )
  })

  test("says when the file is not valid JSON", async () => {
    const file = join(dir, "profile.json")
    await writeFile(file, "{ personal: ")

    await expect(loadProfile(file)).rejects.toThrow(`The profile in ${file} is not valid JSON.`)
  })
})

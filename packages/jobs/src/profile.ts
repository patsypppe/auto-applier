// Reads data/profile.json, the same profile shape the extension saves, and checks it with the core's validateProfile.
import { readFile } from "node:fs/promises"
import { validateProfile, type Profile } from "@auto-applier/core"

// Reads and checks the profile, or says what is wrong with it, one problem per line.
export async function loadProfile(file: string): Promise<Profile> {
  let text: string
  try {
    text = await readFile(file, "utf8")
  } catch {
    throw new Error(`No profile at ${file}. Copy data.example/profile.example.json to data/profile.json and fill it in.`)
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`The profile in ${file} is not valid JSON.`)
  }

  const result = validateProfile(raw)
  if (!result.ok) throw new Error(`The profile in ${file} has problems:\n${result.errors.map((error) => `  ${error}`).join("\n")}`)
  return result.profile
}

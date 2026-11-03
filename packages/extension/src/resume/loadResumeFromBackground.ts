// Gets the saved resume from the background worker (which can read the extension's database) and decodes its bytes.
import type { StoredResume } from "@auto-applier/core"
import { isResumeResponse } from "../messaging"
import type { GetResumeRequest } from "../messaging"
import { base64ToBytes } from "./base64"

// Asks the worker for the resume; returns undefined when none is saved, or throws the reason it could not be had.
export async function loadResumeFromBackground(): Promise<StoredResume | undefined> {
  const request: GetResumeRequest = { type: "get-resume" }

  let reply: unknown
  try {
    reply = await chrome.runtime.sendMessage(request)
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "unknown error"
    throw new Error(`Could not reach the extension's background worker: ${reason}`)
  }

  if (!isResumeResponse(reply)) throw new Error("The background worker sent an unexpected reply")
  if (!reply.ok) throw new Error(reply.error)
  if (!reply.resume) return undefined

  return { name: reply.resume.name, mimeType: reply.resume.mimeType, data: base64ToBytes(reply.resume.data) }
}

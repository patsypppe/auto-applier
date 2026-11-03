// Answers a request for the saved resume: reads it from the resume store and replies with its bytes as text, or the reason it failed.
import type { ResumeStore } from "@auto-applier/core"
import type { ResumeResponse } from "../messaging"
import { bytesToBase64 } from "./base64"
import { RESUME_KEY } from "./resumeKey"

// Replies with the saved resume, with no resume when none is saved, or with the reason reading it failed.
export async function answerResumeRequest(store: ResumeStore): Promise<ResumeResponse> {
  try {
    const resume = await store.load(RESUME_KEY)
    if (!resume) return { ok: true }

    return { ok: true, resume: { name: resume.name, mimeType: resume.mimeType, data: bytesToBase64(resume.data) } }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not read the saved resume" }
  }
}

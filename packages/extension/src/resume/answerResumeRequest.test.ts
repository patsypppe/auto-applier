// Tests that the worker answers a resume request with the saved file as text, an empty answer when none is saved, or the reason it failed.
import type { ResumeStore, StoredResume } from "@auto-applier/core"
import { describe, expect, test } from "vitest"
import { answerResumeRequest } from "./answerResumeRequest"
import { bytesToBase64 } from "./base64"

const RESUME: StoredResume = {
  name: "resume.pdf",
  mimeType: "application/pdf",
  data: new TextEncoder().encode("%PDF").buffer as ArrayBuffer,
}

// Builds a store that holds the given resume under the given key only.
function storeWith(resume: StoredResume | undefined, key = "resume"): ResumeStore & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    save: async () => undefined,
    load: async (wanted) => {
      asked.push(wanted)
      return wanted === key ? resume : undefined
    },
  }
}

describe("answerResumeRequest", () => {
  test("replies with the saved resume's name, type and bytes as text", async () => {
    const reply = await answerResumeRequest(storeWith(RESUME))

    expect(reply).toEqual({
      ok: true,
      resume: { name: "resume.pdf", mimeType: "application/pdf", data: bytesToBase64(RESUME.data) },
    })
  })

  test("asks the store for the resume saved by the upload", async () => {
    const store = storeWith(RESUME)

    await answerResumeRequest(store)

    expect(store.asked).toEqual(["resume"])
  })

  test("replies ok with no resume when none is saved", async () => {
    expect(await answerResumeRequest(storeWith(undefined))).toEqual({ ok: true })
  })

  test("replies with the reason when the store fails", async () => {
    const store: ResumeStore = {
      save: async () => undefined,
      load: async () => {
        throw new Error("database unavailable")
      },
    }

    expect(await answerResumeRequest(store)).toEqual({ ok: false, error: "database unavailable" })
  })

  test("replies with a generic reason when something other than an error is thrown", async () => {
    const store: ResumeStore = {
      save: async () => undefined,
      load: async () => {
        throw "weird"
      },
    }

    expect(await answerResumeRequest(store)).toEqual({ ok: false, error: "Could not read the saved resume" })
  })
})

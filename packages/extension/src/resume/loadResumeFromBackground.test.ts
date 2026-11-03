// Tests that the content script gets the saved resume from the background worker, decoded, or a clear reason it could not.
import { afterEach, describe, expect, test, vi } from "vitest"
import { bytesToBase64 } from "./base64"
import { loadResumeFromBackground } from "./loadResumeFromBackground"

const BYTES = new TextEncoder().encode("%PDF")

// Replaces the chrome global with a runtime whose sendMessage behaves as given.
function stubSendMessage(sendMessage: (message: unknown) => Promise<unknown>) {
  const spy = vi.fn(sendMessage)
  vi.stubGlobal("chrome", { runtime: { sendMessage: spy } })
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("loadResumeFromBackground", () => {
  test("asks the worker for the resume", async () => {
    const sendMessage = stubSendMessage(async () => ({ ok: true }))

    await loadResumeFromBackground()

    expect(sendMessage).toHaveBeenCalledWith({ type: "get-resume" })
  })

  test("returns the resume with its bytes decoded", async () => {
    stubSendMessage(async () => ({
      ok: true,
      resume: { name: "resume.pdf", mimeType: "application/pdf", data: bytesToBase64(BYTES.buffer as ArrayBuffer) },
    }))

    const resume = await loadResumeFromBackground()

    expect([resume?.name, resume?.mimeType]).toEqual(["resume.pdf", "application/pdf"])
    expect(Array.from(new Uint8Array(resume!.data))).toEqual(Array.from(BYTES))
  })

  test("returns nothing when no resume is saved", async () => {
    stubSendMessage(async () => ({ ok: true }))

    expect(await loadResumeFromBackground()).toBeUndefined()
  })

  test("throws the worker's reason when it could not read the resume", async () => {
    stubSendMessage(async () => ({ ok: false, error: "database unavailable" }))

    await expect(loadResumeFromBackground()).rejects.toThrow("database unavailable")
  })

  test("throws when the reply is not in the expected shape", async () => {
    stubSendMessage(async () => ({ something: "else" }))

    await expect(loadResumeFromBackground()).rejects.toThrow("unexpected reply")
  })

  test("explains a failure to reach the background worker", async () => {
    stubSendMessage(async () => {
      throw new Error("Receiving end does not exist.")
    })

    await expect(loadResumeFromBackground()).rejects.toThrow(
      "Could not reach the extension's background worker: Receiving end does not exist.",
    )
  })
})

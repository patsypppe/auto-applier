// Tests the apply-by-link panel: it checks the address, asks the background worker to open it, and says what happened.
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { mountApplyPanel } from "./ApplyPanel"

let sendMessage: ReturnType<typeof vi.fn>

// Mounts the panel into a fresh page.
function mount(): void {
  document.body.innerHTML = '<div id="root"></div>'
  mountApplyPanel(document.getElementById("root")!)
}

const input = () => document.querySelector("input") as HTMLInputElement
const status = () => document.querySelector('[role="status"]')?.textContent ?? ""

// Types a link and presses the button.
function submit(link: string): void {
  input().value = link
  document.querySelector("button")!.click()
}

beforeEach(() => {
  sendMessage = vi.fn(async () => ({ ok: true }))
  vi.stubGlobal("chrome", { runtime: { sendMessage } })
  mount()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ApplyPanel", () => {
  test("has a labelled link box and an Open and apply button", () => {
    expect(document.querySelector("label")?.textContent).toMatch(/application link/i)
    expect(document.querySelector("button")?.textContent).toBe("Open and apply")
  })

  test("asks the worker to open the link and tells the person to watch the new tab", async () => {
    submit("https://jobs.acme.com/openings/1")

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "apply-to-link", url: "https://jobs.acme.com/openings/1" }))
    await vi.waitFor(() => expect(status()).toMatch(/new tab/i))
  })

  test("trims spaces around the link", async () => {
    submit("  https://jobs.acme.com/1  ")

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: "apply-to-link", url: "https://jobs.acme.com/1" }))
  })

  test.each(["", "jobs.acme.com/1", "javascript:alert(1)", "ftp://x.com/a"])("does not send %s and asks for a web address", (link) => {
    submit(link)

    expect(sendMessage).not.toHaveBeenCalled()
    expect(status()).toMatch(/http/i)
  })

  test("shows the worker's reason when it refuses", async () => {
    sendMessage.mockResolvedValueOnce({ ok: false, error: "Could not open a new tab." })

    submit("https://jobs.acme.com/1")

    await vi.waitFor(() => expect(status()).toBe("Could not open a new tab."))
  })

  test("says it could not reach the extension when sending fails", async () => {
    sendMessage.mockRejectedValueOnce(new Error("Receiving end does not exist."))

    submit("https://jobs.acme.com/1")

    await vi.waitFor(() => expect(status()).toMatch(/reload the extension/i))
  })
})

// Tests the LLM settings panel: one section per provider, saving keeps the other provider's settings, and Test checks one provider.
// @vitest-environment jsdom
import type { ProviderSettings, SettingsStore } from "@auto-applier/core"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { mountSettingsPanel } from "./SettingsPanel"

const GEMINI = { apiKey: "gemini-key", model: "gemini-model" }
const GROQ = { apiKey: "groq-key", model: "groq-model" }

// Builds a settings store that starts with the given settings and remembers what is saved.
function fakeStore(initial: ProviderSettings) {
  let current = initial
  const save = vi.fn(async (settings: ProviderSettings) => {
    current = settings
  })
  const store: SettingsStore = { load: async () => current, save }
  return { store, save }
}

// Mounts the panel into a fresh page and waits for it to render.
async function mountPanel(initial: ProviderSettings) {
  document.body.innerHTML = '<div id="root"></div>'
  const fake = fakeStore(initial)
  await mountSettingsPanel(document.getElementById("root")!, fake.store)
  return fake
}

// Returns the section for a provider.
function section(provider: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-provider="${provider}"]`)!
}

// Returns an input of a provider's section by its id suffix.
function input(provider: string, field: "api-key" | "model"): HTMLInputElement {
  return section(provider).querySelector<HTMLInputElement>(`#${provider}-${field}`)!
}

// Returns the button of a provider's section with the given text.
function button(provider: string, text: string): HTMLButtonElement {
  return [...section(provider).querySelectorAll("button")].find((candidate) => candidate.textContent === text)!
}

// Returns the status line text of a provider's section.
function status(provider: string): string {
  return section(provider).querySelector('[role="status"]')?.textContent ?? ""
}

// Replaces the chrome global with a runtime whose sendMessage answers as given.
function stubSendMessage(reply: unknown) {
  const sendMessage = vi.fn(async () => reply)
  vi.stubGlobal("chrome", { runtime: { sendMessage } })
  return sendMessage
}

beforeEach(() => {
  document.body.innerHTML = ""
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("SettingsPanel: layout", () => {
  test("shows a section for Gemini and one for Groq", async () => {
    await mountPanel({})

    expect(section("gemini")).not.toBeNull()
    expect(section("groq")).not.toBeNull()
    expect(section("gemini").textContent).toContain("Gemini")
    expect(section("groq").textContent).toContain("Groq")
  })

  test("fills in the saved model and the default model for a provider with nothing saved", async () => {
    await mountPanel({ gemini: GEMINI })

    expect(input("gemini", "model").value).toBe("gemini-model")
    expect(input("groq", "model").value).not.toBe("")
  })

  test("never shows a saved key, only that one is saved", async () => {
    await mountPanel({ gemini: GEMINI })

    expect(input("gemini", "api-key").value).toBe("")
    expect(input("gemini", "api-key").placeholder).toContain("Saved")
    expect(input("groq", "api-key").placeholder).not.toContain("Saved")
  })
})

describe("SettingsPanel: saving", () => {
  test("saves a new Groq key and keeps the saved Gemini settings", async () => {
    const { save } = await mountPanel({ gemini: GEMINI })
    input("groq", "api-key").value = "new-groq-key"
    input("groq", "model").value = "groq-model-2"

    button("groq", "Save").click()

    await vi.waitFor(() => expect(status("groq")).toBe("Saved."))
    expect(save).toHaveBeenCalledWith({ gemini: GEMINI, groq: { apiKey: "new-groq-key", model: "groq-model-2" } })
  })

  test("keeps the saved key when the key box is left blank", async () => {
    const { save } = await mountPanel({ gemini: GEMINI })
    input("gemini", "model").value = "another-model"

    button("gemini", "Save").click()

    await vi.waitFor(() => expect(save).toHaveBeenCalled())
    expect(save).toHaveBeenCalledWith({ gemini: { apiKey: "gemini-key", model: "another-model" } })
  })

  test("asks for a key and saves nothing when there is none", async () => {
    const { save } = await mountPanel({})

    button("groq", "Save").click()

    await vi.waitFor(() => expect(status("groq")).toBe("Enter an API key first."))
    expect(save).not.toHaveBeenCalled()
  })

  test("clears the key box and shows it as saved afterwards", async () => {
    await mountPanel({})
    input("groq", "api-key").value = "typed-key"

    button("groq", "Save").click()

    await vi.waitFor(() => expect(status("groq")).toBe("Saved."))
    expect(input("groq", "api-key").value).toBe("")
    expect(input("groq", "api-key").placeholder).toContain("Saved")
  })

  test("shows the reason when saving fails", async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const store: SettingsStore = {
      load: async () => ({}),
      save: async () => {
        throw new Error("storage full")
      },
    }
    await mountSettingsPanel(document.getElementById("root")!, store)
    input("groq", "api-key").value = "typed-key"

    button("groq", "Save").click()

    await vi.waitFor(() => expect(status("groq")).toBe("storage full"))
  })
})

describe("SettingsPanel: testing a connection", () => {
  test("tests only the provider whose button was pressed", async () => {
    await mountPanel({ gemini: GEMINI, groq: GROQ })
    const sendMessage = stubSendMessage({ ok: true, data: { ok: true } })

    button("groq", "Test connection").click()

    await vi.waitFor(() => expect(status("groq")).toBe("Connected. Groq answered."))
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "llm-complete", provider: "groq" }))
  })

  test("asks to save the key first when that provider has none", async () => {
    await mountPanel({ gemini: GEMINI })
    const sendMessage = stubSendMessage({ ok: true, data: {} })

    button("groq", "Test connection").click()

    await vi.waitFor(() => expect(status("groq")).toBe("Save your Groq key first."))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  test("shows the reason when the test fails", async () => {
    await mountPanel({ gemini: GEMINI })
    stubSendMessage({ ok: false, error: "Gemini returned 503: busy" })

    button("gemini", "Test connection").click()

    await vi.waitFor(() => expect(status("gemini")).toBe("Gemini returned 503: busy"))
  })
})

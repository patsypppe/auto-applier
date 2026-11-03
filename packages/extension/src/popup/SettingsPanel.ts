// Renders one LLM settings section per provider (API key, model, Save and Test connection) inside the popup.
import { DEFAULT_MODELS, PROVIDER_LABELS, PROVIDER_ORDER, mergeSettings, withProvider } from "@auto-applier/core"
import type { ProviderId, SettingsStore } from "@auto-applier/core"
import { BackgroundLLMClient } from "../llm/BackgroundLLMClient"

const TEST_PROMPT = 'Reply with this JSON and nothing else: {"ok": true}'
const SAVED_PLACEHOLDER = "Saved. Leave blank to keep it."

const PROVIDER_ROLES: Record<ProviderId, string> = {
  gemini: "tried first",
  groq: "backup, optional",
}

const PROVIDER_HOSTS: Record<ProviderId, string> = {
  gemini: "Google",
  groq: "Groq",
}

// Creates a label and an input in one wrapper, and returns both so the caller can read the input.
function createRow(id: string, labelText: string, type: string): { row: HTMLElement; input: HTMLInputElement } {
  const input = document.createElement("input")
  input.id = id
  input.type = type
  input.autocomplete = "off"

  const label = document.createElement("label")
  label.htmlFor = id
  label.textContent = labelText

  const row = document.createElement("div")
  row.className = "field"
  row.append(label, input)
  return { row, input }
}

// Creates a plain button with the given text.
function createButton(text: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = text
  return button
}

// Returns the message of an error, or a generic one when the thrown value is not an Error.
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong"
}

// Builds one provider's section and wires up Save and Test; Save re-reads the store so it never overwrites the other provider.
async function mountProviderSection(container: HTMLElement, provider: ProviderId, store: SettingsStore): Promise<void> {
  const label = PROVIDER_LABELS[provider]
  const saved = (await store.load())[provider]

  const section = document.createElement("section")
  section.className = "provider"
  section.dataset.provider = provider

  const heading = document.createElement("h3")
  heading.textContent = `${label} (${PROVIDER_ROLES[provider]})`

  const key = createRow(`${provider}-api-key`, `${label} API key`, "password")
  key.input.placeholder = saved ? SAVED_PLACEHOLDER : "Paste your key here"
  const model = createRow(`${provider}-model`, "Model", "text")
  model.input.value = saved?.model ?? DEFAULT_MODELS[provider]

  const saveButton = createButton("Save")
  const testButton = createButton("Test connection")
  const buttons = document.createElement("div")
  buttons.className = "buttons"
  buttons.append(saveButton, testButton)

  const status = document.createElement("p")
  status.setAttribute("role", "status")
  const note = document.createElement("p")
  note.className = "note"
  note.textContent = `Your key stays in this browser and is only sent to ${PROVIDER_HOSTS[provider]}.`

  saveButton.addEventListener("click", async () => {
    try {
      const all = await store.load()
      const merged = mergeSettings(all[provider], key.input.value, model.input.value, provider)
      if (!merged) {
        status.textContent = "Enter an API key first."
        return
      }

      await store.save(withProvider(all, provider, merged))
      key.input.value = ""
      key.input.placeholder = SAVED_PLACEHOLDER
      model.input.value = merged.model
      status.textContent = "Saved."
    } catch (error: unknown) {
      status.textContent = errorText(error)
    }
  })

  testButton.addEventListener("click", async () => {
    status.textContent = "Testing…"
    try {
      if (!(await store.load())[provider]) {
        status.textContent = `Save your ${label} key first.`
        return
      }
      await new BackgroundLLMClient(provider).completeJson(TEST_PROMPT)
      status.textContent = `Connected. ${label} answered.`
    } catch (error: unknown) {
      status.textContent = errorText(error)
    }
  })

  section.append(heading, key.row, model.row, buttons, status, note)
  container.append(section)
}

// Shows how the providers work together, then one section for each provider in the order they are tried.
export async function mountSettingsPanel(container: HTMLElement, store: SettingsStore): Promise<void> {
  const intro = document.createElement("p")
  intro.className = "note"
  intro.textContent =
    "Providers are tried in this order. If one fails, the next answers instead. Your prompts, including resume text, go to whichever provider answers."
  container.append(intro)

  for (const provider of PROVIDER_ORDER) {
    await mountProviderSection(container, provider, store)
  }
}

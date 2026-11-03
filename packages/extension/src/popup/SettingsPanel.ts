// Renders the LLM settings (API key and model) with Save and Test connection buttons inside the popup.
import { DEFAULT_MODEL, mergeSettings } from "@auto-applier/core"
import type { LLMSettings, SettingsStore } from "@auto-applier/core"
import { BackgroundLLMClient } from "../llm/BackgroundLLMClient"

const TEST_PROMPT = 'Reply with this JSON and nothing else: {"ok": true}'
const SAVED_PLACEHOLDER = "Saved. Leave blank to keep it."

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

// Shows the saved model and a key box that keeps the saved key when left blank, and wires up Save and Test.
export async function mountSettingsPanel(container: HTMLElement, store: SettingsStore): Promise<void> {
  let saved: LLMSettings | undefined = await store.load()

  const key = createRow("api-key", "Gemini API key", "password")
  key.input.placeholder = saved ? SAVED_PLACEHOLDER : "Paste your key here"
  const model = createRow("model", "Model", "text")
  model.input.value = saved?.model ?? DEFAULT_MODEL

  const saveButton = createButton("Save settings")
  const testButton = createButton("Test connection")
  const buttons = document.createElement("div")
  buttons.className = "buttons"
  buttons.append(saveButton, testButton)

  const status = document.createElement("p")
  status.setAttribute("role", "status")
  const note = document.createElement("p")
  note.className = "note"
  note.textContent = "Your key stays in this browser and is only sent to Google."

  saveButton.addEventListener("click", async () => {
    const merged = mergeSettings(saved, key.input.value, model.input.value)
    if (!merged) {
      status.textContent = "Enter an API key first."
      return
    }

    try {
      await store.save(merged)
      saved = merged
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
      if (!(await store.load())) {
        status.textContent = "Save your key first."
        return
      }
      await new BackgroundLLMClient().completeJson(TEST_PROMPT)
      status.textContent = "Connected. Gemini answered."
    } catch (error: unknown) {
      status.textContent = errorText(error)
    }
  })

  container.append(key.row, model.row, buttons, status, note)
}

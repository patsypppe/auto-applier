// Describes the user's LLM settings and checks stored values before they are trusted.
export type LLMSettings = {
  apiKey: string
  model: string
}

export const DEFAULT_MODEL = "gemini-3.1-flash-lite"

// Combines saved settings with what was typed: a blank key keeps the saved one, a blank model uses the default, and no key at all gives undefined.
export function mergeSettings(
  saved: LLMSettings | undefined,
  keyInput: string,
  modelInput: string,
): LLMSettings | undefined {
  const apiKey = keyInput.trim() || saved?.apiKey || ""
  if (apiKey === "") return undefined

  return { apiKey, model: modelInput.trim() || DEFAULT_MODEL }
}

// Returns true when an unknown value is an object with a non-empty key and model.
export function isLLMSettings(value: unknown): value is LLMSettings {
  if (typeof value !== "object" || value === null) return false

  const { apiKey, model } = value as { apiKey?: unknown; model?: unknown }
  return typeof apiKey === "string" && apiKey !== "" && typeof model === "string" && model !== ""
}

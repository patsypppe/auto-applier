// Describes the user's LLM settings and checks stored values before they are trusted.
export type LLMSettings = {
  apiKey: string
  model: string
}

export const DEFAULT_MODEL = "gemini-3.5-flash-lite"

// Returns true when an unknown value is an object with a non-empty key and model.
export function isLLMSettings(value: unknown): value is LLMSettings {
  if (typeof value !== "object" || value === null) return false

  const { apiKey, model } = value as { apiKey?: unknown; model?: unknown }
  return typeof apiKey === "string" && apiKey !== "" && typeof model === "string" && model !== ""
}

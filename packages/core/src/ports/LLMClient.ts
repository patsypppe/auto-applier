// Defines how the core asks an LLM for JSON, without knowing which provider is used.
export interface LLMClient {
  completeJson(prompt: string): Promise<unknown>
}

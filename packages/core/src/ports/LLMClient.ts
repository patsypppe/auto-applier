export interface LLMClient {
  completeJson(prompt: string): Promise<unknown>
}

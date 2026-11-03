// Tries several LLM clients in order and returns the first answer, so one provider being down does not stop the app.
import type { LLMClient } from "../ports/LLMClient"

const NO_CLIENTS_MESSAGE = "No LLM is set up. Add an API key in the extension's LLM settings."

// Returns the readable reason an unknown thrown value gives.
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error"
}

export class FallbackLLMClient implements LLMClient {
  private readonly clients: readonly LLMClient[]

  constructor(clients: readonly LLMClient[]) {
    this.clients = clients
  }

  // Sends the prompt to each client in turn until one answers, or throws every reason when none does.
  async completeJson(prompt: string): Promise<unknown> {
    if (this.clients.length === 0) throw new Error(NO_CLIENTS_MESSAGE)

    const reasons: string[] = []
    for (const client of this.clients) {
      try {
        return await client.completeJson(prompt)
      } catch (error: unknown) {
        reasons.push(reasonOf(error))
      }
    }
    throw new Error(reasons.join("; "))
  }
}

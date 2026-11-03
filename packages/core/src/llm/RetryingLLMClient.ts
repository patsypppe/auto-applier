// Wraps an LLM client and tries again, after a short wait, when it fails in a temporary way.
import type { LLMClient } from "../ports/LLMClient"
import { LLMRequestError } from "./LLMRequestError"

export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1000, 3000]

export type RetryOptions = {
  delaysMs?: readonly number[]
  sleep?: (ms: number) => Promise<void>
}

// Waits for the given number of milliseconds.
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class RetryingLLMClient implements LLMClient {
  private readonly client: LLMClient
  private readonly delaysMs: readonly number[]
  private readonly sleep: (ms: number) => Promise<void>

  constructor(client: LLMClient, options: RetryOptions = {}) {
    this.client = client
    this.delaysMs = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS
    this.sleep = options.sleep ?? wait
  }

  // Asks the client, and after a temporary failure waits and asks again, once per delay; permanent failures are thrown at once.
  async completeJson(prompt: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.client.completeJson(prompt)
      } catch (error: unknown) {
        const delay = this.delaysMs[attempt]
        const canRetry = error instanceof LLMRequestError && error.retryable
        if (delay === undefined || !canRetry) throw error
        await this.sleep(delay)
      }
    }
  }
}

// An LLM failure that also says whether trying the same request again might work.
export class LLMRequestError extends Error {
  readonly retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = "LLMRequestError"
    this.retryable = retryable
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

// Returns true for HTTP statuses that mean "busy or broken right now" rather than "your request is wrong".
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status)
}

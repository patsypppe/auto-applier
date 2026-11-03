// Asks Groq's OpenAI-compatible chat API for an answer and returns it parsed as JSON.
import type { LLMClient } from "../ports/LLMClient"
import type { LLMSettings } from "./settings"

const CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_TIMEOUT_MS = 30_000

export type GroqOptions = {
  fetchFn?: typeof fetch
  timeoutMs?: number
}

type GroqBody = {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  error?: { message?: string }
}

// Reads a response body as JSON, or returns undefined when it is not JSON (the caller falls back to the status).
async function readJson(response: Response): Promise<GroqBody | undefined> {
  try {
    return (await response.json()) as GroqBody
  } catch {
    return undefined
  }
}

// Builds the error for a failed response from Groq's message, or the status text when there is none.
function apiError(response: Response, body: GroqBody | undefined): Error {
  const message = body?.error?.message ?? (response.statusText || "no details")
  const hint = response.status === 429 ? " You may have hit the rate limit; wait a moment and try again." : ""
  return new Error(`Groq returned ${response.status}: ${message}${hint}`)
}

// Pulls the answer text out of a successful response, or throws a message saying why there is none.
function answerText(body: GroqBody | undefined): string {
  const choice = body?.choices?.[0]
  if (!choice) throw new Error("Groq returned no answer")
  if (choice.finish_reason && choice.finish_reason !== "stop") {
    throw new Error(`Groq stopped early (${choice.finish_reason})`)
  }

  const text = choice.message?.content ?? ""
  if (text.trim() === "") throw new Error("Groq returned an empty answer")
  return text
}

export class GroqLLMClient implements LLMClient {
  private readonly settings: LLMSettings
  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number

  constructor(settings: LLMSettings, options: GroqOptions = {}) {
    this.settings = settings
    // Wrapped in an arrow so the browser's fetch is not called as a method of this class, which it rejects.
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  // Sends the prompt to Groq and returns its answer parsed as JSON.
  async completeJson(prompt: string): Promise<unknown> {
    if (this.settings.apiKey.trim() === "") {
      throw new Error("No Groq API key is set. Add one in the extension's LLM settings.")
    }

    const response = await this.send(prompt)
    const body = await readJson(response)
    if (!response.ok) throw apiError(response, body)

    const text = answerText(body)
    try {
      return JSON.parse(text)
    } catch {
      throw new Error("Groq did not return valid JSON")
    }
  }

  // Posts the prompt, giving up after the timeout and turning network failures into readable errors.
  private async send(prompt: string): Promise<Response> {
    const { apiKey, model } = this.settings
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      return await this.fetchFn(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      })
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new Error("Groq did not answer in time")
      throw new Error(`Could not reach Groq: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      clearTimeout(timer)
    }
  }
}

// Asks Google's Gemini API for an answer and returns it parsed as JSON.
import type { LLMClient } from "../ports/LLMClient"
import type { LLMSettings } from "./settings"

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
const DEFAULT_TIMEOUT_MS = 30_000

export type GeminiOptions = {
  fetchFn?: typeof fetch
  timeoutMs?: number
}

type GeminiBody = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

// Reads a response body as JSON, or returns undefined when it is not JSON (the caller falls back to the status).
async function readJson(response: Response): Promise<GeminiBody | undefined> {
  try {
    return (await response.json()) as GeminiBody
  } catch {
    return undefined
  }
}

// Builds the error for a failed response from Google's message, or the status text when there is none.
function apiError(response: Response, body: GeminiBody | undefined): Error {
  const message = body?.error?.message ?? (response.statusText || "no details")
  const hint = response.status === 429 ? " You may have hit the rate limit; wait a moment and try again." : ""
  return new Error(`Gemini returned ${response.status}: ${message}${hint}`)
}

// Pulls the answer text out of a successful response, or throws a message saying why there is none.
function answerText(body: GeminiBody | undefined): string {
  const candidate = body?.candidates?.[0]
  if (!candidate) {
    const reason = body?.promptFeedback?.blockReason
    throw new Error(reason ? `Gemini blocked the prompt (${reason})` : "Gemini returned no answer")
  }
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Gemini stopped early (${candidate.finishReason})`)
  }

  const parts = candidate.content?.parts
  const text = (Array.isArray(parts) ? parts : []).map((part) => part.text ?? "").join("")
  if (text.trim() === "") throw new Error("Gemini returned an empty answer")
  return text
}

export class GeminiLLMClient implements LLMClient {
  private readonly settings: LLMSettings
  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number

  constructor(settings: LLMSettings, options: GeminiOptions = {}) {
    this.settings = settings
    // Wrapped in an arrow so the browser's fetch is not called as a method of this class, which it rejects.
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  // Sends the prompt to Gemini and returns its answer parsed as JSON.
  async completeJson(prompt: string): Promise<unknown> {
    if (this.settings.apiKey.trim() === "") {
      throw new Error("No Gemini API key is set. Add one in the extension's LLM settings.")
    }

    const response = await this.send(prompt)
    const body = await readJson(response)
    if (!response.ok) throw apiError(response, body)

    const text = answerText(body)
    try {
      return JSON.parse(text)
    } catch {
      throw new Error("Gemini did not return valid JSON")
    }
  }

  // Posts the prompt, giving up after the timeout and turning network failures into readable errors.
  private async send(prompt: string): Promise<Response> {
    const { apiKey, model } = this.settings
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      return await this.fetchFn(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      })
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new Error("Gemini did not answer in time")
      throw new Error(`Could not reach Gemini: ${error instanceof Error ? error.message : "unknown error"}`)
    } finally {
      clearTimeout(timer)
    }
  }
}

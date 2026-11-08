// Tests that the AI is asked to pick the Apply button only from real candidates, and that a made-up or missing pick is ignored.
import { describe, expect, test, vi } from "vitest"
import type { LLMClient } from "../ports/LLMClient"
import { buildChooseApplyPrompt, chooseApplyWithAi, parseChoice } from "./chooseApply"

const CANDIDATES = [
  { index: 0, text: "Join our team", href: "/careers/open" },
  { index: 1, text: "Learn more" },
]
const PAGE = { host: "acme.com", title: "Engineer at Acme" }

// Builds a model stand-in with a fixed reply.
function llmReplying(reply: unknown, fail = false): LLMClient {
  return { completeJson: vi.fn(async () => { if (fail) throw new Error("down"); return reply }) }
}

describe("buildChooseApplyPrompt", () => {
  test("lists every candidate with its number, text and link, and the page", () => {
    const prompt = buildChooseApplyPrompt(CANDIDATES, PAGE)

    for (const part of ["Join our team", "/careers/open", "Learn more", "acme.com", "Engineer at Acme"]) expect(prompt).toContain(part)
  })

  test("treats the page text as untrusted and forbids submit, sign-in, saving and sharing", () => {
    const prompt = buildChooseApplyPrompt(CANDIDATES, PAGE)

    expect(prompt).toMatch(/untrusted/i)
    expect(prompt).toMatch(/submit/i)
    expect(prompt).toMatch(/sign in|log in/i)
    expect(prompt).toMatch(/null/)
  })
})

describe("parseChoice", () => {
  test("accepts the number of a listed candidate", () => {
    expect(parseChoice({ index: 1 }, CANDIDATES)).toBe(1)
  })

  test("rejects null, a number that is not listed, a non-number and a wrong shape", () => {
    expect(parseChoice({ index: null }, CANDIDATES)).toBeUndefined()
    expect(parseChoice({ index: 9 }, CANDIDATES)).toBeUndefined()
    expect(parseChoice({ index: "0" }, CANDIDATES)).toBeUndefined()
    expect(parseChoice("rubbish", CANDIDATES)).toBeUndefined()
  })
})

describe("chooseApplyWithAi", () => {
  test("returns the model's pick", async () => {
    expect(await chooseApplyWithAi(llmReplying({ index: 0 }), CANDIDATES, PAGE)).toBe(0)
  })

  test("does not ask when there are no candidates", async () => {
    const llm = llmReplying({ index: 0 })

    expect(await chooseApplyWithAi(llm, [], PAGE)).toBeUndefined()
    expect(llm.completeJson).not.toHaveBeenCalled()
  })

  test("returns nothing when the model fails", async () => {
    expect(await chooseApplyWithAi(llmReplying(undefined, true), CANDIDATES, PAGE)).toBeUndefined()
  })
})

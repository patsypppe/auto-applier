// Waits for a page to reach some state, such as a dropdown's options appearing.
export type WaitTiming = {
  timeoutMs: number
  pollMs: number
}

// Polls the condition until it is true or the time runs out, and resolves with which of the two happened.
export function waitUntil(condition: () => boolean, { timeoutMs, pollMs }: WaitTiming): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs

    const check = (): void => {
      if (condition()) return resolve(true)
      if (Date.now() >= deadline) return resolve(false)
      setTimeout(check, pollMs)
    }

    check()
  })
}

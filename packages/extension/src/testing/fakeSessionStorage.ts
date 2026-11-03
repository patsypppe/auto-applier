// Test helper: an in-memory stand-in for chrome.storage.session and chrome.storage.onChanged.
import { vi } from "vitest"

type Changes = Record<string, { newValue?: unknown }>
type ChangeListener = (changes: Changes, areaName: string) => void

// Creates fake storage whose session area keeps items in memory and tells listeners which keys changed.
export function createFakeSessionStorage() {
  const items = new Map<string, unknown>()
  const listeners: ChangeListener[] = []

  // Tells every listener that the given session keys changed.
  function notify(keys: string[]): void {
    const changes: Changes = Object.fromEntries(keys.map((key) => [key, { newValue: items.get(key) }]))
    for (const listener of [...listeners]) listener(changes, "session")
  }

  const session = {
    get: vi.fn(async (keys?: string | string[] | null) => {
      const wanted = keys === null || keys === undefined ? [...items.keys()] : [keys].flat()
      return Object.fromEntries(wanted.filter((key) => items.has(key)).map((key) => [key, items.get(key)]))
    }),
    set: vi.fn(async (values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values)) items.set(key, value)
      notify(Object.keys(values))
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const removed = [keys].flat()
      for (const key of removed) items.delete(key)
      notify(removed)
    }),
  }

  const onChanged = {
    addListener: (listener: ChangeListener) => listeners.push(listener),
    removeListener: (listener: ChangeListener) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
  }

  return { storage: { session, onChanged }, items, listeners }
}

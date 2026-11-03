// Tests that resume files are saved to and read back from IndexedDB, byte for byte.
import "fake-indexeddb/auto"
import { describe, expect, test } from "vitest"
import { IndexedDbResumeStore } from "./IndexedDbResumeStore"

let databaseCounter = 0

// Creates a store on its own database so tests do not see each other's data.
function freshStore(): { store: IndexedDbResumeStore; databaseName: string } {
  const databaseName = `test-db-${databaseCounter++}`
  return { store: new IndexedDbResumeStore(databaseName), databaseName }
}

// Builds a stored resume holding the given bytes.
function resumeWith(bytes: number[], name = "resume.pdf") {
  return { name, mimeType: "application/pdf", data: new Uint8Array(bytes).buffer }
}

describe("IndexedDbResumeStore", () => {
  test("returns undefined for a resume that was never saved", async () => {
    const { store } = freshStore()

    expect(await store.load("resume")).toBeUndefined()
  })

  test("reads back what was saved, including the bytes", async () => {
    const { store } = freshStore()

    await store.save("resume", resumeWith([1, 2, 3, 250]))
    const loaded = await store.load("resume")

    expect(loaded?.name).toBe("resume.pdf")
    expect(loaded?.mimeType).toBe("application/pdf")
    expect(new Uint8Array(loaded!.data)).toEqual(new Uint8Array([1, 2, 3, 250]))
  })

  test("replaces an earlier resume saved under the same key", async () => {
    const { store } = freshStore()

    await store.save("resume", resumeWith([1], "old.pdf"))
    await store.save("resume", resumeWith([2], "new.pdf"))
    const loaded = await store.load("resume")

    expect(loaded?.name).toBe("new.pdf")
    expect(new Uint8Array(loaded!.data)).toEqual(new Uint8Array([2]))
  })

  test("keeps different keys apart", async () => {
    const { store } = freshStore()

    await store.save("a", resumeWith([1], "a.pdf"))
    await store.save("b", resumeWith([2], "b.pdf"))

    expect((await store.load("a"))?.name).toBe("a.pdf")
    expect((await store.load("b"))?.name).toBe("b.pdf")
  })

  test("a new store object on the same database sees what was saved", async () => {
    const { store, databaseName } = freshStore()
    await store.save("resume", resumeWith([9, 9]))

    const reopened = new IndexedDbResumeStore(databaseName)

    expect(new Uint8Array((await reopened.load("resume"))!.data)).toEqual(new Uint8Array([9, 9]))
  })
})

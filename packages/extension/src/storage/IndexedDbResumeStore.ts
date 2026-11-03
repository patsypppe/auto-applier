// Keeps resume files in IndexedDB, because chrome.storage is not meant for large binary files.
import type { ResumeStore, StoredResume } from "@auto-applier/core"

const DEFAULT_DATABASE = "auto-applier"
const STORE_NAME = "resumes"

// Wraps an IndexedDB request in a promise for its result.
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("The resume database request failed"))
  })
}

// Wraps an IndexedDB transaction in a promise that resolves once it has been fully committed.
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("The resume database write failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("The resume database write was cancelled"))
  })
}

export class IndexedDbResumeStore implements ResumeStore {
  private readonly databaseName: string
  private database: Promise<IDBDatabase> | undefined

  constructor(databaseName: string = DEFAULT_DATABASE) {
    this.databaseName = databaseName
  }

  // Opens the database once and reuses the connection, creating the resume store the first time.
  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("Could not open the resume database"))
    })
    return this.database
  }

  // Saves the resume under the key, replacing any earlier one, and waits until it is committed.
  async save(key: string, resume: StoredResume): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).put(resume, key)
    await transactionDone(transaction)
  }

  // Reads the resume saved under the key, or undefined when there is none.
  async load(key: string): Promise<StoredResume | undefined> {
    const database = await this.open()
    const stored = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key))
    return stored as StoredResume | undefined
  }
}

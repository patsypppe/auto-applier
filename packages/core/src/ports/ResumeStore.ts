// Defines how resume files are saved and read back, without knowing where they are kept.
export type StoredResume = {
  name: string
  mimeType: string
  data: ArrayBuffer
}

export interface ResumeStore {
  save(key: string, resume: StoredResume): Promise<void>
  load(key: string): Promise<StoredResume | undefined>
}

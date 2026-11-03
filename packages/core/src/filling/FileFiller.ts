// Fills a file input by attaching the saved resume, when the input accepts that kind of file and has no file yet.
import type { FormField } from "../fields/types"
import type { StoredResume } from "../ports/ResumeStore"
import { fireChangeEvents } from "./events"
import type { Filler, FillResult } from "./types"

export type LoadResume = () => Promise<StoredResume | undefined>
export type AttachFile = (input: HTMLInputElement, file: File) => void

// Gives the input the file the way a file picker would, by handing it a DataTransfer's files.
function attachWithDataTransfer(input: HTMLInputElement, file: File): void {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
}

// Returns true when an input's accept attribute allows the file; an empty attribute allows everything.
function accepts(accept: string, file: { name: string; type: string }): boolean {
  const allowed = accept.split(",").map((token) => token.trim().toLowerCase()).filter((token) => token !== "")
  if (allowed.length === 0) return true

  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return allowed.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token)
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1))
    return type === token
  })
}

// Returns true when the element is a file input.
function isFileInput(element: HTMLElement): element is HTMLInputElement {
  return element.localName === "input" && (element as HTMLInputElement).type === "file"
}

export class FileFiller implements Filler {
  private readonly loadResume: LoadResume
  private readonly attach: AttachFile

  constructor(loadResume: LoadResume, attach: AttachFile = attachWithDataTransfer) {
    this.loadResume = loadResume
    this.attach = attach
  }

  // Accepts fields whose kind is file.
  canFill(field: FormField): boolean {
    return field.kind === "file"
  }

  // Attaches the saved resume (the value is only a sign that one exists), tells the page, and checks the input took it.
  async fill(field: FormField, _value: string): Promise<FillResult> {
    const input = field.element
    if (!isFileInput(input)) return { status: "failed", reason: "Field is not a file input" }
    if (input.disabled) return { status: "skipped", reason: "Field is disabled" }
    if ((input.files?.length ?? 0) > 0) return { status: "skipped", reason: "Field already has a value" }

    const resume = await this.loadResume()
    if (!resume) return { status: "failed", reason: "No resume file is saved. Upload one in the extension popup first." }
    if (!accepts(input.accept, { name: resume.name, type: resume.mimeType })) return { status: "failed", reason: `This field does not accept ${resume.name}` }

    this.attach(input, new File([resume.data], resume.name, { type: resume.mimeType }))
    fireChangeEvents(input)
    return (input.files?.length ?? 0) > 0
      ? { status: "filled" }
      : { status: "failed", reason: "The page did not accept the file" }
  }
}

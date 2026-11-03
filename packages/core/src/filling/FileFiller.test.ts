// Tests that FileFiller attaches the saved resume to a file input, respects what the input accepts, and never replaces a chosen file.
// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest"
import { discoverFields } from "../fields/discoverFields"
import type { StoredResume } from "../ports/ResumeStore"
import { makeField } from "../testing/makeField"
import { FileFiller } from "./FileFiller"

const RESUME: StoredResume = {
  name: "resume.pdf",
  mimeType: "application/pdf",
  data: new TextEncoder().encode("%PDF").buffer as ArrayBuffer,
}

// Loads a file input with the given extra attributes and returns its field.
function fileField(attributes = "") {
  document.body.innerHTML = `<input type="file" id="f" name="resume" ${attributes} />`
  const [field] = discoverFields(document)
  if (!field) throw new Error("No field found")
  return field
}

// Builds a filler with a resume loader and a fake attach step that records the file and exposes it as the input's files.
function fillerWith(resume: StoredResume | null = RESUME, accepted = true) {
  const attached: File[] = []
  const attach = vi.fn((input: HTMLInputElement, file: File) => {
    attached.push(file)
    if (accepted) Object.defineProperty(input, "files", { value: [file], configurable: true })
  })
  return { filler: new FileFiller(async () => resume ?? undefined, attach), attached, attach }
}

describe("FileFiller", () => {
  test("accepts file fields only", () => {
    const { filler } = fillerWith()

    expect(filler.canFill(makeField({ kind: "file" }))).toBe(true)
    expect(filler.canFill(makeField({ kind: "text" }))).toBe(false)
  })

  test("attaches the saved resume under its own name and type", async () => {
    const { filler, attached } = fillerWith()

    const result = await filler.fill(fileField(), "resume.pdf")

    expect(result).toEqual({ status: "filled" })
    expect(attached).toHaveLength(1)
    expect([attached[0]?.name, attached[0]?.type, attached[0]?.size]).toEqual(["resume.pdf", "application/pdf", 4])
  })

  test("tells the page by firing input and change events", async () => {
    const { filler } = fillerWith()
    const field = fileField()
    const seen: string[] = []
    field.element.addEventListener("input", () => seen.push("input"))
    field.element.addEventListener("change", () => seen.push("change"))

    await filler.fill(field, "resume.pdf")

    expect(seen).toEqual(["input", "change"])
  })

  test("skips an input that already has a file", async () => {
    const { filler, attach } = fillerWith()
    const field = fileField()
    Object.defineProperty(field.element, "files", { value: [new File(["x"], "mine.pdf")], configurable: true })

    expect(await filler.fill(field, "resume.pdf")).toEqual({ status: "skipped", reason: "Field already has a value" })
    expect(attach).not.toHaveBeenCalled()
  })

  test("fails clearly when no resume is saved", async () => {
    const { filler, attach } = fillerWith(null)

    const result = await filler.fill(fileField(), "resume.pdf")

    expect(result).toMatchObject({ status: "failed", reason: expect.stringContaining("No resume file is saved") })
    expect(attach).not.toHaveBeenCalled()
  })

  test("fails when the page did not take the file", async () => {
    const { filler } = fillerWith(RESUME, false)

    expect(await filler.fill(fileField(), "resume.pdf")).toEqual({
      status: "failed",
      reason: "The page did not accept the file",
    })
  })

  test("fails when the field's element is not a file input", async () => {
    const { filler } = fillerWith()

    expect(await filler.fill(makeField({ kind: "file" }), "resume.pdf")).toMatchObject({ status: "failed" })
  })
})

describe("FileFiller: what the input accepts", () => {
  test.each([
    ["", "no restriction"],
    [".pdf,.doc,.docx", "the file extension"],
    [".DOC, .PDF", "the extension in any case, with spaces"],
    ["application/pdf", "the exact type"],
    ["application/*", "a type group"],
    ["image/*,.pdf", "a mix"],
  ])("attaches when accept is %j (%s)", async (accept) => {
    const { filler } = fillerWith()

    expect(await filler.fill(fileField(accept ? `accept="${accept}"` : ""), "resume.pdf")).toEqual({ status: "filled" })
  })

  test.each([[".doc,.docx"], ["image/*"], ["text/plain"]])("refuses when accept is %j", async (accept) => {
    const { filler, attach } = fillerWith()

    const result = await filler.fill(fileField(`accept="${accept}"`), "resume.pdf")

    expect(result).toMatchObject({ status: "failed", reason: expect.stringContaining("does not accept resume.pdf") })
    expect(attach).not.toHaveBeenCalled()
  })
})

// Tests that resume files are turned into text by the right reader, and unsupported files are refused clearly.
import { describe, expect, test, vi } from "vitest"
import { extractResumeText } from "./extractResumeText"

// Builds a PDF reader stand-in that returns the given text.
function readerReturning(text: string) {
  return vi.fn(async (_data: ArrayBuffer) => text)
}

describe("extractResumeText", () => {
  test("reads a PDF with the PDF reader", async () => {
    const readPdf = readerReturning("Pranav, Software Engineer")
    const file = new File([new Uint8Array([37, 80, 68, 70])], "resume.pdf", { type: "application/pdf" })

    expect(await extractResumeText(file, readPdf)).toBe("Pranav, Software Engineer")
    expect(readPdf).toHaveBeenCalledTimes(1)
    expect(new Uint8Array(readPdf.mock.calls[0]![0])).toEqual(new Uint8Array([37, 80, 68, 70]))
  })

  test("recognises a PDF by its extension when the browser gives no type", async () => {
    const readPdf = readerReturning("from pdf")
    const file = new File(["%PDF"], "Resume.PDF", { type: "" })

    expect(await extractResumeText(file, readPdf)).toBe("from pdf")
  })

  test("reads a plain text file directly", async () => {
    const readPdf = readerReturning("should not be used")
    const file = new File(["Pranav\nSoftware Engineer"], "resume.txt", { type: "text/plain" })

    expect(await extractResumeText(file, readPdf)).toBe("Pranav\nSoftware Engineer")
    expect(readPdf).not.toHaveBeenCalled()
  })

  test("recognises text and markdown files by their extension", async () => {
    const readPdf = readerReturning("unused")

    expect(await extractResumeText(new File(["notes"], "resume.md", { type: "" }), readPdf)).toBe("notes")
    expect(await extractResumeText(new File(["plain"], "resume.TXT", { type: "" }), readPdf)).toBe("plain")
  })

  test("refuses other file types and says what is supported", async () => {
    const file = new File(["x"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    await expect(extractResumeText(file, readerReturning("unused"))).rejects.toThrow(
      "Only PDF and plain text resumes are supported for now",
    )
  })

  test("passes on a failure to read the PDF", async () => {
    const readPdf = vi.fn(async () => {
      throw new Error("Could not read this PDF.")
    })
    const file = new File(["%PDF"], "resume.pdf", { type: "application/pdf" })

    await expect(extractResumeText(file, readPdf)).rejects.toThrow("Could not read this PDF.")
  })
})

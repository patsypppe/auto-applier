// Tests that text is read out of a real PDF with pdf.js, line by line, and bad files are refused clearly.
import { join } from "node:path"
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"
import { describe, expect, test } from "vitest"
import { createPdfTextReader } from "./pdfText"
import type { PdfLibrary } from "./pdfText"

const STANDARD_FONTS = join(import.meta.dirname, "../../../../node_modules/pdfjs-dist/standard_fonts/")

const readPdfText = createPdfTextReader(pdfjs as unknown as PdfLibrary, { standardFontDataUrl: STANDARD_FONTS })

// Builds a tiny single-page PDF whose text is the given lines, one under the other.
function makePdf(lines: string[]): ArrayBuffer {
  const drawing = lines.map((line, index) => `${index === 0 ? "" : "0 -24 Td "}(${line}) Tj`).join(" ")
  const content = `BT /F1 18 Tf 72 720 Td ${drawing} ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]

  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefStart = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return new TextEncoder().encode(body).buffer as ArrayBuffer
}

describe("createPdfTextReader", () => {
  test("reads the text out of a PDF", async () => {
    const text = await readPdfText(makePdf(["Pranav Pattanashetty", "Software Engineer"]))

    expect(text).toContain("Pranav Pattanashetty")
    expect(text).toContain("Software Engineer")
  })

  test("keeps separate lines apart", async () => {
    const text = await readPdfText(makePdf(["Pranav Pattanashetty", "Software Engineer"]))

    expect(text).toMatch(/Pranav Pattanashetty\s+Software Engineer/)
    expect(text).not.toContain("PattanashettySoftware")
  })

  test("returns empty text for a PDF with no text in it", async () => {
    expect((await readPdfText(makePdf([]))).trim()).toBe("")
  })

  test("refuses a file that is not a PDF with a readable message", async () => {
    const notPdf = new TextEncoder().encode("this is just a text file").buffer as ArrayBuffer

    await expect(readPdfText(notPdf)).rejects.toThrow("Could not read this PDF")
  })
})

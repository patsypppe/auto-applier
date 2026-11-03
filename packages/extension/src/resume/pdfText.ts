// Reads the text out of a PDF with pdf.js, which is passed in so the browser and the tests can each supply their own build.
export type PdfTextItem = { str?: string; hasEOL?: boolean }
type PdfPage = { getTextContent(): Promise<{ items: PdfTextItem[] }> }
type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfPage> }
type PdfLoadingTask = { promise: Promise<PdfDocument>; destroy(): Promise<void> }

export type PdfLibrary = {
  getDocument(source: { data: Uint8Array; standardFontDataUrl?: string }): PdfLoadingTask
}

export type PdfReaderOptions = {
  standardFontDataUrl?: string
}

const UNREADABLE_PDF = "Could not read this PDF. It may be damaged or protected with a password."

// Joins the text pieces of one page, starting a new line wherever pdf.js says a line ends.
function pageText(items: PdfTextItem[]): string {
  return items.map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : "")).join("")
}

// Reads every page of an opened document and joins the pages with a blank line.
async function documentText(document: PdfDocument): Promise<string> {
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber)
    pages.push(pageText((await page.getTextContent()).items))
  }
  return pages.join("\n\n").trim()
}

// Builds a function that reads the text of a PDF from its bytes, using the given pdf.js library.
// The font location is needed for PDFs that use standard fonts without embedding them.
export function createPdfTextReader(
  library: PdfLibrary,
  options: PdfReaderOptions = {},
): (data: ArrayBuffer) => Promise<string> {
  return async (data) => {
    try {
      // pdf.js takes ownership of the bytes it is given, so it gets a copy and the caller keeps the original.
      const source = { data: new Uint8Array(data.slice(0)), standardFontDataUrl: options.standardFontDataUrl }
      const task = library.getDocument(source)
      try {
        return await documentText(await task.promise)
      } finally {
        await task.destroy()
      }
    } catch (error: unknown) {
      throw new Error(UNREADABLE_PDF, { cause: error })
    }
  }
}

// Reads PDF text in the browser, using the pdf.js worker and fonts that the build copies into the extension.
import * as pdfjs from "pdfjs-dist"
import { createPdfTextReader } from "./pdfText"
import type { PdfLibrary } from "./pdfText"

pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.min.mjs")

export const readPdfInBrowser = createPdfTextReader(pdfjs as unknown as PdfLibrary, {
  standardFontDataUrl: chrome.runtime.getURL("standard_fonts/"),
})

// Turns an uploaded resume file into plain text: PDFs go through a PDF reader, text files are read directly.
const PDF_EXTENSION = /\.pdf$/i
const TEXT_EXTENSION = /\.(txt|md)$/i

export type PdfReader = (data: ArrayBuffer) => Promise<string>

// Returns true when the browser or the file name says the file is a PDF.
function isPdf(file: File): boolean {
  return file.type === "application/pdf" || PDF_EXTENSION.test(file.name)
}

// Returns true when the browser or the file name says the file is plain text or markdown.
function isPlainText(file: File): boolean {
  return file.type === "text/plain" || file.type === "text/markdown" || TEXT_EXTENSION.test(file.name)
}

// Reads the text of a PDF or plain text resume, and refuses any other kind of file.
export async function extractResumeText(file: File, readPdf: PdfReader): Promise<string> {
  if (isPdf(file)) return readPdf(await file.arrayBuffer())
  if (isPlainText(file)) return file.text()

  throw new Error("Only PDF and plain text resumes are supported for now.")
}

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfText {
  text: string
  pageCount: number
}

/** Minimum characters for a PDF to count as text-based (not a scanned image). */
const MIN_TEXT_LENGTH = 40

export class PdfTextError extends Error {}

export async function extractPdfText(file: File): Promise<PdfText> {
  let pdf
  try {
    const data = await file.arrayBuffer()
    pdf = await getDocument({ data }).promise
  } catch {
    throw new PdfTextError("This file couldn't be read as a PDF.")
  }

  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    pages.push(`--- Page ${pageNumber} ---\n${pageText}`)
  }

  const text = pages.join('\n\n')
  const bareText = text.replace(/--- Page \d+ ---/g, '').trim()
  if (bareText.length < MIN_TEXT_LENGTH) {
    throw new PdfTextError(
      'No readable text found — this looks like a scanned image. Only text-based PDFs are supported.',
    )
  }

  return { text, pageCount: pdf.numPages }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

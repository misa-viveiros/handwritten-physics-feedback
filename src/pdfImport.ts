import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  type PDFDocumentLoadingTask,
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type UploadSource = {
  sourceType: 'camera' | 'image' | 'pdf'
  originalFileName?: string
  pdfPageNumber?: number
  pdfPageCount?: number
}

export type PdfImportSession = {
  document: PDFDocumentProxy
  loadingTask: PDFDocumentLoadingTask
  originalFileName: string
  pageCount: number
}

export type RenderedPdfPage = {
  imageFile: File
  pageNumber: number
  pageCount: number
  renderedWidth: number
  renderedHeight: number
  renderScale: number
}

const targetScale = 2
const maxRenderedDimension = 2600
const maxRenderedPixels = 6_000_000
const maxRenderedImageBytes = 8 * 1024 * 1024

export async function openPdfImport(file: File): Promise<PdfImportSession> {
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  })

  try {
    const document = await loadingTask.promise
    return {
      document,
      loadingTask,
      originalFileName: file.name,
      pageCount: document.numPages,
    }
  } catch (error) {
    await loadingTask.destroy()
    throw error
  }
}

export async function renderPdfPageToImage(
  session: PdfImportSession,
  pageNumber: number,
): Promise<RenderedPdfPage> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > session.pageCount) {
    throw new Error('The selected PDF page is unavailable.')
  }

  const page = await session.document.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const renderScale = calculateRenderScale(
    baseViewport.width,
    baseViewport.height,
  )
  const viewport = page.getViewport({ scale: renderScale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(viewport.width))
  canvas.height = Math.max(1, Math.ceil(viewport.height))

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new Error('Canvas rendering is unavailable in this browser.')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  try {
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      background: '#ffffff',
    }).promise

    const imageBlob = await canvasToBoundedJpeg(canvas)
    const baseName =
      session.originalFileName.replace(/\.pdf$/i, '') || 'solution'
    const imageFile = new File(
      [imageBlob],
      `${baseName}-page-${pageNumber}.jpg`,
      { type: 'image/jpeg', lastModified: Date.now() },
    )

    return {
      imageFile,
      pageNumber,
      pageCount: session.pageCount,
      renderedWidth: Math.ceil(viewport.width),
      renderedHeight: Math.ceil(viewport.height),
      renderScale,
    }
  } finally {
    page.cleanup()
    canvas.width = 1
    canvas.height = 1
  }
}

export async function closePdfImport(session: PdfImportSession | null) {
  if (session) {
    await session.loadingTask.destroy()
  }
}

export function calculateRenderScale(width: number, height: number): number {
  const dimensionScale = maxRenderedDimension / Math.max(width, height)
  const pixelScale = Math.sqrt(maxRenderedPixels / (width * height))
  return Math.min(targetScale, dimensionScale, pixelScale)
}

function canvasToBoundedJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const qualities = [0.94, 0.88, 0.8]

    const encode = (qualityIndex: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('The PDF page could not be converted to an image.'))
            return
          }

          if (blob.size <= maxRenderedImageBytes) {
            resolve(blob)
            return
          }

          if (qualityIndex + 1 < qualities.length) {
            encode(qualityIndex + 1)
            return
          }

          reject(
            new Error(
              'The rendered PDF page is too large. Try exporting it as an image instead.',
            ),
          )
        },
        'image/jpeg',
        qualities[qualityIndex],
      )
    }

    encode(0)
  })
}

import type { ImportedPdf } from '@/data/types'

export interface ReadyPdfSource {
  status: 'ready'
  url: string
  kind: 'server' | 'blob' | 'file-handle'
  revokeOnRelease: boolean
}

export type PdfSourceResult =
  | ReadyPdfSource
  | { status: 'permission-denied'; reason: string }
  | { status: 'not-found'; reason: string }

interface ResolvePdfSourceOptions {
  requestPermission?: boolean
}

/** Resolve every supported ImportedPdf source into a URL consumable by PdfViewer. */
export async function resolvePdfSource(
  pdf: ImportedPdf,
  options: ResolvePdfSourceOptions = {}
): Promise<PdfSourceResult> {
  if (pdf.serverUrl?.trim()) {
    return {
      status: 'ready',
      url: pdf.serverUrl,
      kind: 'server',
      revokeOnRelease: false,
    }
  }

  if (pdf.fileBlob) {
    return {
      status: 'ready',
      url: URL.createObjectURL(pdf.fileBlob),
      kind: 'blob',
      revokeOnRelease: true,
    }
  }

  if (!pdf.fileHandle) {
    return {
      status: 'not-found',
      reason: 'The PDF file is not available on this device.',
    }
  }

  try {
    const permission = await pdf.fileHandle.queryPermission({ mode: 'read' })
    if (permission !== 'granted') {
      if (!options.requestPermission) {
        return {
          status: 'permission-denied',
          reason: 'Permission is required to read this PDF.',
        }
      }

      const result = await pdf.fileHandle.requestPermission({ mode: 'read' })
      if (result !== 'granted') {
        return {
          status: 'permission-denied',
          reason: 'Permission to read this PDF was denied.',
        }
      }
    }

    const file = await pdf.fileHandle.getFile()
    return {
      status: 'ready',
      url: URL.createObjectURL(file),
      kind: 'file-handle',
      revokeOnRelease: true,
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError')
    ) {
      return {
        status: 'permission-denied',
        reason: 'Permission is required to read this PDF.',
      }
    }

    return {
      status: 'not-found',
      reason: 'The PDF file could not be found or opened.',
    }
  }
}

/** Release object URLs while leaving server URLs untouched. */
export function releasePdfSource(source: ReadyPdfSource | null | undefined): void {
  if (source?.revokeOnRelease) URL.revokeObjectURL(source.url)
}

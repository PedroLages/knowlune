import type { VideoMetadata, PdfMetadata, VideoFormat, SupportedFileExtension } from '@/data/types'

export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.ts'] as const
export const SUPPORTED_DOCUMENT_EXTENSIONS = ['.pdf'] as const
export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const
export const SUPPORTED_FILE_EXTENSIONS: readonly SupportedFileExtension[] = [
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
]

export function isSupportedVideoFormat(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext)
}

export function isSupportedFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return (SUPPORTED_FILE_EXTENSIONS as readonly string[]).includes(ext)
}

export function getVideoFormat(filename: string): VideoFormat {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.') + 1)
  return ext as VideoFormat
}

export function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}

export function getFileExtension(filename: string): string {
  return filename.toLowerCase().slice(filename.lastIndexOf('.'))
}

export async function showDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' })
    return handle
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Directory selection was cancelled')
    }
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw new Error(
        'Permission denied: We need access to your course folder to import it. Please grant permission and try again.'
      )
    }
    throw error
  }
}

export async function* scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
  options?: { includeImages?: boolean }
): AsyncGenerator<{ handle: FileSystemFileHandle; path: string }> {
  for await (const entry of dirHandle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name
    if (entry.kind === 'file') {
      if (isSupportedFile(entry.name) || (options?.includeImages && isImageFile(entry.name))) {
        yield { handle: entry as FileSystemFileHandle, path: entryPath }
      }
    } else if (entry.kind === 'directory') {
      yield* scanDirectory(entry as FileSystemDirectoryHandle, entryPath, options)
    }
  }
}

export async function extractVideoMetadata(
  fileHandle: FileSystemFileHandle
): Promise<VideoMetadata> {
  const file = await fileHandle.getFile()
  return extractVideoMetadataFromFile(file)
}

/**
 * Extract video metadata directly from a File object.
 * Used by drag-and-drop import path where FileSystemFileHandle is not available.
 */
export async function extractVideoMetadataFromFile(file: File): Promise<VideoMetadata> {
  const fileSize = file.size
  const blobUrl = URL.createObjectURL(file)
  try {
    return await new Promise<VideoMetadata>((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          fileSize,
        })
        video.remove()
      }
      video.onerror = () => {
        video.remove()
        reject(new Error(`Cannot read metadata: ${file.name}`))
      }
      video.src = blobUrl
    })
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

export async function extractPdfMetadata(fileHandle: FileSystemFileHandle): Promise<PdfMetadata> {
  const file = await fileHandle.getFile()
  return extractPdfMetadataFromFile(file)
}

/**
 * Extract PDF metadata directly from a File object.
 * Used by drag-and-drop import path where FileSystemFileHandle is not available.
 */
export async function extractPdfMetadataFromFile(file: File): Promise<PdfMetadata> {
  const arrayBuffer = await file.arrayBuffer()

  // Use pdf.js (pdfjs-dist) to get page count
  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  return { pageCount: pdf.numPages }
}

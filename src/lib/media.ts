import type { Resource } from '@/data/types'

const MEDIA_BASE = '/media'
const COURSES_ROOT = '/Volumes/SSD/GFX/Chase Hughes - The Operative Kit'

export function getResourceUrl(resource: Resource): string {
  return filePathToUrl(resource.filePath)
}

export function filePathToUrl(filePath: string): string {
  const relative = filePath.replace(COURSES_ROOT, '')
  return `${MEDIA_BASE}${relative}`
}

export function getVideoUrl(filePath: string): string {
  return filePathToUrl(filePath)
}

export function getPdfUrl(filePath: string): string {
  return filePathToUrl(filePath)
}

export { COURSES_ROOT, MEDIA_BASE }

/**
 * Determine whether crossOrigin="anonymous" is needed for an offscreen video
 * used in canvas extraction.
 *
 * - `blob:` URLs — always need crossOrigin; drawImage from blob to canvas
 *   requires CORS-awareness even though the blob is same-origin.
 * - Cross-origin HTTP URLs — need crossOrigin so servers that send CORS
 *   headers still work (existing behavior preserved).
 * - Same-origin HTTP URLs — omit crossOrigin so canvas extraction works
 *   without a CORS handshake. This is the primary fix for server-imported
 *   courses where the video server doesn't send CORS headers.
 * - Relative URLs / parse failures — treated as same-origin (safe default).
 *
 * Returns `undefined` (not `null`) so the value is compatible with React's
 * `CrossOrigin` JSX prop type (`"anonymous" | "use-credentials" | "" | undefined`).
 * Use `?? null` when assigning directly to a DOM element property.
 */
export function crossOriginForUrl(src: string): 'anonymous' | undefined {
  if (src.startsWith('blob:')) return 'anonymous'
  try {
    const url = new URL(src, window.location.href)
    if (url.origin !== window.location.origin) return 'anonymous'
  } catch {
    // Unparseable URL — safest to omit crossOrigin (likely relative path)
  }
  return undefined
}

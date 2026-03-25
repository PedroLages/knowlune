/**
 * File download utilities for browser-based data export.
 *
 * Uses Blob + URL.createObjectURL + anchor click pattern
 * (universal browser support, no File System Access API required).
 */
import JSZip from 'jszip'

/** Download a JSON object as a .json file */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, filename)
}

/** Download a string as a plain text file */
export function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' })
  downloadBlob(blob, filename)
}

/** Bundle multiple files into a zip and download */
export async function downloadZip(
  files: Array<{ name: string; content: string }>,
  filename: string
): Promise<void> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, filename)
}

/** Core download: create object URL, click anchor, revoke after delay */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation to ensure the browser has started the download
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

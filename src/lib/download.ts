/**
 * Triggers a browser file download from a string content.
 *
 * Creates a temporary <a> element with a Blob URL and the `download` attribute,
 * clicks it, then cleans up.
 */
export function downloadAsFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Defer cleanup so the browser has time to initiate the download
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

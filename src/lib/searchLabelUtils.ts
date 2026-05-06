/**
 * Strips the file extension, replaces separators (-, _) with spaces,
 * and title-cases each word. Returns empty string for empty/falsy input
 * so callers can chain with || fallbacks (youtubeVideoId, 'Untitled Lesson').
 */
export function normalizeFilename(filename: string): string {
  if (!filename) return ''
  const withoutExt = filename.replace(/\.[^/.]+$/, '')
  return withoutExt
    .split(/[-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

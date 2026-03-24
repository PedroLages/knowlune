/**
 * Extract initials from a name (max 2 characters).
 * Takes the first letter of each word, uppercased.
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(part => part.length > 0)

  return parts
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

/** Strip HTML tags and decode common entities for plain-text preview. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

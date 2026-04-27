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
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, m => String.fromCharCode(Number(m.slice(2, -1))))
    .trim()
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sanitize and normalize a book description HTML string for safe rendering.
 *
 * Allows only minimal inline formatting: <strong>/<em>/<br />.
 * - Maps <b> -> <strong>, <i> -> <em>
 * - Converts common block containers (<p>, <div>, <li>, etc) into <br /> boundaries
 * - Drops all attributes and disallowed tags (keeps their text content)
 *
 * Note: This is intended for untrusted metadata (e.g. OPDS / Audiobookshelf).
 */
export function sanitizeDescriptionHtml(html: string): string {
  if (!html) return ''

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const parts: string[] = []

  const pushBreak = (opts?: { doubleIfAlready?: boolean }) => {
    const last = parts[parts.length - 1]
    if (last !== '<br />') {
      parts.push('<br />')
      return
    }

    // When consecutive block elements occur, we want a blank line between them
    // (two breaks). Cap at 2 breaks to avoid runaway spacing.
    if (opts?.doubleIfAlready) {
      const secondLast = parts[parts.length - 2]
      if (secondLast !== '<br />') parts.push('<br />')
    }
  }

  const allowedInline = new Set(['strong', 'em', 'br'])
  const inlineAlias: Record<string, 'strong' | 'em'> = { b: 'strong', i: 'em' }
  const breakLike = new Set([
    'p',
    'div',
    'section',
    'article',
    'header',
    'footer',
    'blockquote',
    'pre',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
  ])

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? ''
      if (text) parts.push(escapeHtmlText(text))
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'script' || tag === 'style' || tag === 'noscript') return

    if (tag === 'br') {
      pushBreak()
      return
    }

    const normalizedTag = inlineAlias[tag] ?? tag
    const isAllowedInline = allowedInline.has(normalizedTag)
    const isBreakLike = breakLike.has(tag)

    if (isBreakLike) pushBreak({ doubleIfAlready: true })
    if (isAllowedInline && normalizedTag !== 'br') parts.push(`<${normalizedTag}>`)

    for (const child of Array.from(el.childNodes)) walk(child)

    if (isAllowedInline && normalizedTag !== 'br') parts.push(`</${normalizedTag}>`)
    if (isBreakLike) pushBreak()
  }

  for (const child of Array.from(doc.body.childNodes)) walk(child)

  // Normalize breaks and whitespace.
  let out = parts.join('')
  out = out.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br /><br />')
  out = out.replace(/^\s*(?:<br\s*\/?>\s*)+/i, '')
  out = out.replace(/(?:<br\s*\/?>\s*)+\s*$/i, '')
  out = out.replace(/\s{3,}/g, '  ')

  return out.trim()
}

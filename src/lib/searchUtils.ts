import type { ReactNode } from 'react'
import { createElement } from 'react'

/**
 * Strip markdown link syntax and HTML tags, then truncate to maxLength.
 * Used for rendering note snippets in search results.
 */
export function truncateSnippet(content: string, maxLength = 80): string {
  const text = content.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '\u2026'
}

export interface HighlightPatterns {
  split: RegExp
  test: RegExp
}

/**
 * Split text by matching patterns and wrap matches in <mark> elements.
 * Returns the original text unchanged when patterns is null.
 */
export function highlightMatches(text: string, patterns: HighlightPatterns | null): ReactNode {
  if (!patterns) return text
  const parts = text.split(patterns.split)
  return parts.map((part, i) =>
    patterns.test.test(part)
      ? createElement(
          'mark',
          { key: i, className: 'bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded-sm' },
          part
        )
      : part
  )
}

/**
 * Build highlight patterns from a search query string.
 * Returns null for empty/whitespace queries.
 */
export function buildHighlightPatterns(query: string): HighlightPatterns | null {
  if (!query.trim()) return null
  const terms = query.trim().split(/\s+/).filter(Boolean)
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return {
    split: new RegExp(`(${escaped})`, 'gi'),
    test: new RegExp(`^(?:${escaped})$`, 'i'),
  }
}

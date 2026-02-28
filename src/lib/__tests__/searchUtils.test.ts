import { describe, it, expect } from 'vitest'
import { truncateSnippet, highlightMatches, buildHighlightPatterns } from '@/lib/searchUtils'

describe('truncateSnippet', () => {
  it('should return short text unchanged', () => {
    expect(truncateSnippet('Hello world')).toBe('Hello world')
  })

  it('should truncate long text with ellipsis', () => {
    const longText = 'A'.repeat(100)
    const result = truncateSnippet(longText, 80)
    expect(result.length).toBe(81) // 80 chars + ellipsis
    expect(result.endsWith('\u2026')).toBe(true)
  })

  it('should strip markdown link syntax', () => {
    const input = 'Check [this link](https://example.com) for details'
    expect(truncateSnippet(input)).toBe('Check this link for details')
  })

  it('should strip HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>'
    expect(truncateSnippet(input)).toBe('Hello world')
  })

  it('should strip video:// timestamp links from TipTap notes', () => {
    const input = 'At [0:08](video://8.5) he explains the concept'
    expect(truncateSnippet(input)).toBe('At 0:08 he explains the concept')
  })

  it('should handle combined markdown and HTML', () => {
    const input = '<p>[Click here](http://example.com) for <em>more</em> info</p>'
    expect(truncateSnippet(input)).toBe('Click here for more info')
  })
})

describe('buildHighlightPatterns', () => {
  it('should return null for empty query', () => {
    expect(buildHighlightPatterns('')).toBeNull()
    expect(buildHighlightPatterns('   ')).toBeNull()
  })

  it('should create patterns for single term', () => {
    const patterns = buildHighlightPatterns('react')
    expect(patterns).not.toBeNull()
    expect(patterns!.split).toBeInstanceOf(RegExp)
    expect(patterns!.test).toBeInstanceOf(RegExp)
  })

  it('should create patterns for multi-word queries', () => {
    const patterns = buildHighlightPatterns('react hooks')
    expect(patterns).not.toBeNull()
    // Split should match either term
    expect('I love react and hooks'.split(patterns!.split)).toContain('react')
    expect('I love react and hooks'.split(patterns!.split)).toContain('hooks')
  })

  it('should escape regex special characters', () => {
    const patterns = buildHighlightPatterns('C++')
    expect(patterns).not.toBeNull()
    // Should not throw when used
    expect(() => 'Learning C++ basics'.split(patterns!.split)).not.toThrow()
  })
})

describe('highlightMatches', () => {
  it('should return plain text when patterns is null', () => {
    const result = highlightMatches('Hello world', null)
    expect(result).toBe('Hello world')
  })

  it('should wrap matching terms in mark elements', () => {
    const patterns = buildHighlightPatterns('react')
    const result = highlightMatches('Learning react today', patterns)

    // Result should be an array (React fragment parts)
    expect(Array.isArray(result)).toBe(true)
    const parts = result as Array<unknown>
    expect(parts).toHaveLength(3) // "Learning ", <mark>react</mark>, " today"

    // Middle element should be a mark element
    const markElement = parts[1] as { type: string; props: { children: string; className: string } }
    expect(markElement.type).toBe('mark')
    expect(markElement.props.children).toBe('react')
    expect(markElement.props.className).toContain('bg-yellow-200')
  })

  it('should highlight multiple occurrences', () => {
    const patterns = buildHighlightPatterns('the')
    const result = highlightMatches('the cat and the dog', patterns)

    expect(Array.isArray(result)).toBe(true)
    const parts = result as Array<unknown>
    // Count mark elements
    const marks = parts.filter(
      (p): p is { type: string } => typeof p === 'object' && p !== null && (p as { type?: string }).type === 'mark',
    )
    expect(marks.length).toBe(2)
  })

  it('should highlight case-insensitively', () => {
    const patterns = buildHighlightPatterns('React')
    const result = highlightMatches('I love REACT and react', patterns)

    expect(Array.isArray(result)).toBe(true)
    const parts = result as Array<unknown>
    const marks = parts.filter(
      (p): p is { type: string } => typeof p === 'object' && p !== null && (p as { type?: string }).type === 'mark',
    )
    expect(marks.length).toBe(2)
  })

  it('should return original text when no matches found', () => {
    const patterns = buildHighlightPatterns('xyz')
    const result = highlightMatches('Hello world', patterns)

    // Should still return array but no mark elements
    expect(Array.isArray(result)).toBe(true)
    const parts = result as Array<unknown>
    const marks = parts.filter(
      (p): p is { type: string } => typeof p === 'object' && p !== null && (p as { type?: string }).type === 'mark',
    )
    expect(marks.length).toBe(0)
  })
})

/**
 * BookCoverImage tests — fallback rendering on img error and missing src.
 *
 * @since fix/E-ABS-QA R1 (F4 from R1 review)
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BookCoverImage } from '../BookCoverImage'

describe('BookCoverImage', () => {
  it('renders an <img> when src is provided and not errored', () => {
    render(<BookCoverImage src="https://example.com/cover.jpg" title="The Pragmatic Programmer" />)
    const img = screen.getByRole('img', { name: /Cover of The Pragmatic Programmer/ })
    expect(img).toBeDefined()
    expect(img.tagName).toBe('IMG')
  })

  it('renders fallback when src is nullish', () => {
    render(<BookCoverImage src={null} title="Ulysses" />)
    const fallback = screen.getByTestId('book-cover-fallback')
    expect(fallback).toBeDefined()
    // First-initial fallback — grapheme-safe uppercase.
    expect(fallback.textContent).toContain('U')
  })

  it('renders fallback when src is undefined', () => {
    render(<BookCoverImage title="Moby Dick" />)
    expect(screen.getByTestId('book-cover-fallback')).toBeDefined()
  })

  it('swaps to fallback when the img fires onError', () => {
    render(<BookCoverImage src="https://example.com/broken.jpg" title="Dune" />)
    const img = screen.getByRole('img', { name: /Cover of Dune/ })
    expect(img.tagName).toBe('IMG')
    // Simulate a 404 / 429 / network error on the img element.
    fireEvent.error(img)
    // After error, the img should be replaced by the fallback tile.
    expect(screen.getByTestId('book-cover-fallback')).toBeDefined()
    expect(screen.getByTestId('book-cover-fallback').textContent).toContain('D')
  })

  it('renders glyph when title is empty (no first initial)', () => {
    render(<BookCoverImage src={null} title="   " />)
    const fallback = screen.getByTestId('book-cover-fallback')
    expect(fallback).toBeDefined()
    // No alphabetic content — glyph icon renders instead of a letter.
    expect(fallback.querySelector('svg')).not.toBeNull()
  })
})

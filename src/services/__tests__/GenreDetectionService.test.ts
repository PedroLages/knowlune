/**
 * Unit tests for GenreDetectionService.
 *
 * @since E108-S05
 */
import { describe, it, expect } from 'vitest'
import { detectGenre } from '../GenreDetectionService'

describe('detectGenre', () => {
  it('returns "Other" for empty subjects', () => {
    expect(detectGenre([])).toBe('Other')
  })

  it('returns "Other" for null-ish input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(detectGenre(null as any)).toBe('Other')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(detectGenre(undefined as any)).toBe('Other')
  })

  it('detects Fiction from direct keyword match', () => {
    expect(detectGenre(['Fiction', 'Literature'])).toBe('Fiction')
  })

  it('detects Science Fiction from specific keywords', () => {
    expect(detectGenre(['Science fiction', 'Space exploration'])).toBe('Science Fiction')
  })

  it('detects Fantasy', () => {
    expect(detectGenre(['Fantasy fiction', 'Magic', 'Dragons'])).toBe('Fantasy')
  })

  it('detects Mystery from thriller keyword', () => {
    expect(detectGenre(['Thriller', 'Suspense'])).toBe('Mystery')
  })

  it('detects Biography', () => {
    expect(detectGenre(['Biography', 'American presidents'])).toBe('Biography')
  })

  it('detects Technology from computer keyword', () => {
    expect(detectGenre(['Computer programming', 'Software development'])).toBe('Technology')
  })

  it('detects Psychology', () => {
    expect(detectGenre(['Psychology', 'Cognitive science'])).toBe('Psychology')
  })

  it('detects Philosophy', () => {
    expect(detectGenre(['Philosophy', 'Ethics'])).toBe('Philosophy')
  })

  it('detects History', () => {
    expect(detectGenre(['World War II', 'History'])).toBe('History')
  })

  it('detects Business', () => {
    expect(detectGenre(['Business', 'Entrepreneurship'])).toBe('Business')
  })

  it('detects Self-Help', () => {
    expect(detectGenre(['Self-help', 'Personal development'])).toBe('Self-Help')
  })

  it('detects Romance', () => {
    expect(detectGenre(['Romance', 'Love stories'])).toBe('Romance')
  })

  it('returns "Other" for unrecognized subjects', () => {
    expect(detectGenre(['Cooking', 'Recipes', 'French cuisine'])).toBe('Other')
  })

  it('picks genre with most keyword matches when ambiguous', () => {
    // Two science-fiction keywords vs one fiction keyword
    expect(detectGenre(['Science fiction', 'Dystopia', 'Fiction'])).toBe('Science Fiction')
  })

  it('is case-insensitive', () => {
    expect(detectGenre(['FANTASY', 'MAGIC'])).toBe('Fantasy')
  })

  it('handles partial keyword matches', () => {
    // "psychological studies" contains "psycholog" keyword
    expect(detectGenre(['Psychological studies'])).toBe('Psychology')
  })
})

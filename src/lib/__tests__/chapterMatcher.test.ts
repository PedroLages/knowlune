import { describe, it, expect } from 'vitest'
import {
  normalizeChapterTitle,
  jaroWinklerSimilarity,
  levenshteinDistance,
  levenshteinSimilarity,
  computeChapterMapping,
  DEFAULT_CONFIDENCE_THRESHOLD,
  type EpubChapterInput,
  type AudioChapterInput,
} from '../chapterMatcher'

describe('normalizeChapterTitle', () => {
  it('lowercases and trims', () => {
    expect(normalizeChapterTitle('  The Journey Begins  ')).toBe('the journey begins')
  })

  it('strips leading numbers and separators', () => {
    expect(normalizeChapterTitle('Chapter 1: The Journey Begins')).toBe(
      'chapter 1: the journey begins'
    )
    expect(normalizeChapterTitle('1. The Journey Begins')).toBe('the journey begins')
    expect(normalizeChapterTitle('12 - The Journey')).toBe('the journey')
    expect(normalizeChapterTitle('  3.  Hello')).toBe('hello')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeChapterTitle('The   Journey   Begins')).toBe('the journey begins')
  })

  it('handles empty string', () => {
    expect(normalizeChapterTitle('')).toBe('')
  })

  it('handles "PART TWO"', () => {
    expect(normalizeChapterTitle('PART TWO')).toBe('part two')
  })
})

describe('jaroWinklerSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1)
  })

  it('returns 0 for empty vs non-empty', () => {
    expect(jaroWinklerSimilarity('', 'hello')).toBe(0)
    expect(jaroWinklerSimilarity('hello', '')).toBe(0)
  })

  it('returns 1 for two empty strings', () => {
    expect(jaroWinklerSimilarity('', '')).toBe(1)
  })

  it('returns high score for similar strings with common prefix', () => {
    const score = jaroWinklerSimilarity('the journey begins', 'the journey')
    expect(score).toBeGreaterThan(0.85)
  })

  it('returns low score for very different strings', () => {
    const score = jaroWinklerSimilarity('abc', 'xyz')
    expect(score).toBeLessThan(0.5)
  })
})

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0)
  })

  it('returns string length for empty comparison', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5)
    expect(levenshteinDistance('hello', '')).toBe(5)
  })

  it('computes correct distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3)
  })
})

describe('levenshteinSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1)
  })

  it('returns 1 for two empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1)
  })

  it('returns value between 0 and 1', () => {
    const score = levenshteinSimilarity('abc', 'xyz')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('computeChapterMapping', () => {
  it('returns empty for empty inputs', () => {
    expect(computeChapterMapping([], [])).toEqual([])
    expect(computeChapterMapping([{ href: 'a', label: 'A' }], [])).toEqual([])
    expect(computeChapterMapping([], [{ title: 'A' }])).toEqual([])
  })

  it('matches exact titles', () => {
    const epub: EpubChapterInput[] = [
      { href: 'ch1.xhtml', label: 'The Beginning' },
      { href: 'ch2.xhtml', label: 'The Middle' },
      { href: 'ch3.xhtml', label: 'The End' },
    ]
    const audio: AudioChapterInput[] = [
      { title: 'The Beginning' },
      { title: 'The Middle' },
      { title: 'The End' },
    ]

    const result = computeChapterMapping(epub, audio)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      epubChapterHref: 'ch1.xhtml',
      audioChapterIndex: 0,
      confidence: 1,
    })
    expect(result[1]).toEqual({
      epubChapterHref: 'ch2.xhtml',
      audioChapterIndex: 1,
      confidence: 1,
    })
  })

  it('matches numbered vs named chapters ("1. The Journey" vs "The Journey")', () => {
    const epub: EpubChapterInput[] = [
      { href: 'ch1.xhtml', label: '1. The Journey' },
      { href: 'ch2.xhtml', label: '2. The Return' },
    ]
    const audio: AudioChapterInput[] = [{ title: 'The Journey' }, { title: 'The Return' }]

    const result = computeChapterMapping(epub, audio)
    expect(result).toHaveLength(2)
    expect(result[0].epubChapterHref).toBe('ch1.xhtml')
    expect(result[0].audioChapterIndex).toBe(0)
    expect(result[0].confidence).toBeGreaterThanOrEqual(DEFAULT_CONFIDENCE_THRESHOLD)
  })

  it('handles stripped-number normalization', () => {
    const epub: EpubChapterInput[] = [{ href: 'ch1.xhtml', label: 'Chapter 1: The Hero' }]
    const audio: AudioChapterInput[] = [{ title: 'Chapter 1: The Hero' }]

    const result = computeChapterMapping(epub, audio)
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe(1)
  })

  it('respects threshold — below-threshold pairs excluded', () => {
    const epub: EpubChapterInput[] = [{ href: 'ch1.xhtml', label: 'Completely Different Title' }]
    const audio: AudioChapterInput[] = [{ title: 'Something Else Entirely' }]

    const result = computeChapterMapping(epub, audio, 0.9)
    expect(result).toHaveLength(0)
  })

  it('falls back to Levenshtein when JW fails', () => {
    // These titles differ enough that JW might not match at 0.7
    // but Levenshtein should catch "I" vs "1" type differences
    const epub: EpubChapterInput[] = [{ href: 'ch1.xhtml', label: 'The Adventure Begins Now' }]
    const audio: AudioChapterInput[] = [{ title: 'The Adventure Begins' }]

    const result = computeChapterMapping(epub, audio, 0.7)
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('produces mixed-confidence output', () => {
    const epub: EpubChapterInput[] = [
      { href: 'ch1.xhtml', label: 'The Beginning' },
      { href: 'ch2.xhtml', label: '2. A Slightly Different Middle Section' },
    ]
    const audio: AudioChapterInput[] = [{ title: 'The Beginning' }, { title: 'The Middle' }]

    const result = computeChapterMapping(epub, audio)
    // First should be exact match (confidence 1.0)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].confidence).toBe(1)
    // Second may or may not match depending on similarity
  })

  it('does not assign same audio chapter twice (greedy)', () => {
    const epub: EpubChapterInput[] = [
      { href: 'ch1.xhtml', label: 'Hello World' },
      { href: 'ch2.xhtml', label: 'Hello World' },
    ]
    const audio: AudioChapterInput[] = [{ title: 'Hello World' }]

    const result = computeChapterMapping(epub, audio)
    // Only one can be matched — greedy assignment
    expect(result).toHaveLength(1)
  })

  it('returns results sorted by EPUB chapter order', () => {
    const epub: EpubChapterInput[] = [
      { href: 'ch3.xhtml', label: 'C Chapter' },
      { href: 'ch1.xhtml', label: 'A Chapter' },
      { href: 'ch2.xhtml', label: 'B Chapter' },
    ]
    const audio: AudioChapterInput[] = [
      { title: 'A Chapter' },
      { title: 'B Chapter' },
      { title: 'C Chapter' },
    ]

    const result = computeChapterMapping(epub, audio)
    expect(result).toHaveLength(3)
    // Should follow epub input order: ch3, ch1, ch2
    expect(result[0].epubChapterHref).toBe('ch3.xhtml')
    expect(result[1].epubChapterHref).toBe('ch1.xhtml')
    expect(result[2].epubChapterHref).toBe('ch2.xhtml')
  })
})

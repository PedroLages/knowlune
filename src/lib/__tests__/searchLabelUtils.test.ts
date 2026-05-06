import { describe, it, expect } from 'vitest'
import { normalizeFilename } from '../searchLabelUtils'

describe('normalizeFilename', () => {
  it('strips file extension and title-cases hyphen-separated words', () => {
    expect(normalizeFilename('demo-pdf-2.mp4')).toBe('Demo Pdf 2')
  })

  it('handles underscore separators', () => {
    expect(normalizeFilename('Introduction_to_Calculus_Lesson_1.mov')).toBe(
      'Introduction To Calculus Lesson 1'
    )
  })

  it('handles single-letter segments', () => {
    expect(normalizeFilename('a-b-c.mp4')).toBe('A B C')
  })

  it('handles filename with no separators', () => {
    expect(normalizeFilename('lesson')).toBe('Lesson')
  })

  it('returns empty string for empty input so || chains fall through', () => {
    expect(normalizeFilename('')).toBe('')
  })
})

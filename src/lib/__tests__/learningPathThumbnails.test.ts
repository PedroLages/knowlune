import { describe, it, expect } from 'vitest'
import { getPathCourseThumbnailUrls } from '@/lib/learningPathThumbnails'
import type { LearningPathEntry } from '@/data/types'

function entry(courseId: string, position: number): LearningPathEntry {
  return {
    id: `e-${courseId}`,
    pathId: 'p1',
    courseId,
    courseType: 'imported',
    position,
    isManuallyOrdered: false,
  }
}

describe('getPathCourseThumbnailUrls', () => {
  const urls: Record<string, string> = {
    a: 'https://example.com/a.jpg',
    b: 'https://example.com/b.jpg',
    c: 'https://example.com/c.jpg',
  }

  it('returns URLs in entry order up to limit', () => {
    const sorted = [entry('a', 1), entry('b', 2), entry('c', 3)]
    expect(getPathCourseThumbnailUrls(sorted, urls, 4)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg',
    ])
  })

  it('stops at limit', () => {
    const sorted = [entry('a', 1), entry('b', 2), entry('c', 3)]
    expect(getPathCourseThumbnailUrls(sorted, urls, 2)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ])
  })

  it('skips entries without thumbnails', () => {
    const sorted = [entry('a', 1), entry('missing', 2), entry('b', 3)]
    expect(getPathCourseThumbnailUrls(sorted, urls, 4)).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ])
  })

  it('returns empty for empty entries', () => {
    expect(getPathCourseThumbnailUrls([], urls, 4)).toEqual([])
  })

  it('returns empty when limit is 0', () => {
    const sorted = [entry('a', 1)]
    expect(getPathCourseThumbnailUrls(sorted, urls, 0)).toEqual([])
  })

  it('respects caller sort order (not courseId lexicographic)', () => {
    const sorted = [entry('c', 1), entry('a', 2), entry('b', 3)]
    expect(getPathCourseThumbnailUrls(sorted, urls, 4)).toEqual([
      'https://example.com/c.jpg',
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ])
  })
})

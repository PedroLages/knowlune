import { describe, it, expect } from 'vitest'
import { suggestNextCourse } from '../courseSuggestion'
import type { ImportedCourse } from '@/data/types'

function makeCourse(overrides: Partial<ImportedCourse> & { id: string }): ImportedCourse {
  return {
    name: `Course ${overrides.id}`,
    importedAt: '2026-01-01T00:00:00Z',
    category: 'general',
    tags: [],
    status: 'active' as const,
    videoCount: 5,
    pdfCount: 0,
    directoryHandle: null,
    ...overrides,
  } as ImportedCourse
}

describe('suggestNextCourse', () => {
  it('returns null when no other courses exist (AC6)', () => {
    const courses = [makeCourse({ id: 'c1', tags: ['react'] })]
    expect(suggestNextCourse('c1', courses)).toBeNull()
  })

  it('returns null when completed course not found', () => {
    const courses = [makeCourse({ id: 'c1' })]
    expect(suggestNextCourse('nonexistent', courses)).toBeNull()
  })

  it('excludes the completed course from suggestions (AC5)', () => {
    const courses = [
      makeCourse({ id: 'c1', tags: ['react'] }),
      makeCourse({ id: 'c2', tags: ['react'] }),
    ]
    const result = suggestNextCourse('c1', courses)
    expect(result).not.toBeNull()
    expect(result!.course.id).toBe('c2')
  })

  it('prioritizes courses with most overlapping tags (AC5)', () => {
    const courses = [
      makeCourse({ id: 'completed', tags: ['react', 'typescript', 'testing'] }),
      makeCourse({ id: 'one-tag', tags: ['react'] }),
      makeCourse({ id: 'two-tags', tags: ['react', 'typescript'] }),
      makeCourse({ id: 'three-tags', tags: ['react', 'typescript', 'testing'] }),
    ]
    const result = suggestNextCourse('completed', courses)
    expect(result!.course.id).toBe('three-tags')
    expect(result!.sharedTags).toHaveLength(3)
  })

  it('tiebreaks by most recently imported (AC5)', () => {
    const courses = [
      makeCourse({ id: 'completed', tags: ['react'] }),
      makeCourse({ id: 'old', tags: ['react'], importedAt: '2026-01-01T00:00:00Z' }),
      makeCourse({ id: 'new', tags: ['react'], importedAt: '2026-03-01T00:00:00Z' }),
    ]
    const result = suggestNextCourse('completed', courses)
    expect(result!.course.id).toBe('new')
  })

  it('performs case-insensitive tag matching', () => {
    const courses = [
      makeCourse({ id: 'c1', tags: ['React', 'TypeScript'] }),
      makeCourse({ id: 'c2', tags: ['react', 'typescript'] }),
    ]
    const result = suggestNextCourse('c1', courses)
    expect(result!.sharedTags).toHaveLength(2)
  })

  it('returns shared tags in original casing', () => {
    const courses = [
      makeCourse({ id: 'c1', tags: ['React'] }),
      makeCourse({ id: 'c2', tags: ['react'] }),
    ]
    const result = suggestNextCourse('c1', courses)
    expect(result!.sharedTags).toEqual(['react'])
  })
})

import { describe, it, expect, vi } from 'vitest'

const { mockCourseStoreGetState, mockAuthorStoreGetState } = vi.hoisted(() => ({
  mockCourseStoreGetState: vi.fn(() => ({
    courses: [] as Array<{
      authorId: string
      totalLessons: number
      estimatedHours: number
      totalVideos: number
      category: string
    }>,
  })),
  mockAuthorStoreGetState: vi.fn(() => ({
    isLoaded: true,
    isLoading: false,
    loadAuthors: vi.fn(),
    getAuthorById: vi.fn(() => null),
  })),
}))

vi.mock('@/stores/useCourseStore', () => ({
  useCourseStore: { getState: mockCourseStoreGetState },
}))

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: { getState: mockAuthorStoreGetState },
}))

import {
  getMergedAuthors,
  getInitials,
  getAuthorStats,
  getImportedAuthorStats,
  getAuthorForCourse,
  getAuthorForImportedCourse,
  getAvatarSrc,
  flattenSpecialties,
  totalCoursesForAuthor,
  withAuthorCourseCounts,
} from '../authors'

describe('authors', () => {
  describe('getInitials', () => {
    it('extracts initials from multi-word name', () => {
      expect(getInitials('John Doe')).toBe('JD')
    })

    it('handles single-word name', () => {
      expect(getInitials('Alice')).toBe('A')
    })
  })

  describe('getAvatarSrc', () => {
    it('returns external URL directly', () => {
      const result = getAvatarSrc('https://example.com/photo.jpg', 48)
      expect(result).toEqual({ src: 'https://example.com/photo.jpg' })
    })

    it('returns empty src for empty path', () => {
      const result = getAvatarSrc('', 48)
      expect(result).toEqual({ src: '' })
    })

    it('picks smallest width >= displaySize for 1x', () => {
      const result = getAvatarSrc('/avatar/user1', 48)
      expect(result.src).toBe('/avatar/user1-48w.jpg')
    })

    it('picks 2x width for srcSet', () => {
      const result = getAvatarSrc('/avatar/user1', 48)
      expect(result.srcSet).toContain('96w')
    })

    it('falls back to largest width for large display sizes', () => {
      const result = getAvatarSrc('/avatar/user1', 500)
      expect(result.src).toBe('/avatar/user1-256w.jpg')
    })
  })

  describe('getMergedAuthors', () => {
    it('converts imported authors to AuthorView', () => {
      const imported = [
        {
          id: 'author-1',
          name: 'Jane Smith',
          bio: 'A bio',
          isPreseeded: false,
          createdAt: '2026-01-01',
        },
      ]
      const result = getMergedAuthors(imported as never[])
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Jane Smith')
      expect(result[0].isPreseeded).toBe(false)
    })

    it('normalizes CSV-like specialties on AuthorView', () => {
      const imported = [
        {
          id: 'author-1',
          name: 'Jane Smith',
          bio: 'A bio',
          specialties: ['DevOps, Cloud, CI/CD'],
          isPreseeded: false,
          createdAt: '2026-01-01',
        },
      ]
      const result = getMergedAuthors(imported as never[])
      expect(result[0].specialties).toEqual(['DevOps', 'Cloud', 'CI/CD'])
    })
  })

  describe('flattenSpecialties', () => {
    it('preserves well-formed multi-entry order', () => {
      expect(flattenSpecialties(['React', 'Node'])).toEqual(['React', 'Node'])
    })

    it('splits a single comma-separated entry', () => {
      expect(flattenSpecialties(['A, B, C'])).toEqual(['A', 'B', 'C'])
    })

    it('splits on semicolons and pipes', () => {
      expect(flattenSpecialties(['A; B', 'X|Y'])).toEqual(['A', 'B', 'X', 'Y'])
    })

    it('drops whitespace-only entries and keeps Rust', () => {
      expect(flattenSpecialties(['  ', '', 'Rust'])).toEqual(['Rust'])
    })

    it('dedupes case-insensitively keeping first spelling', () => {
      expect(flattenSpecialties(['react', 'React', 'node'])).toEqual(['react', 'node'])
    })

    it('keeps single token without delimiters unchanged', () => {
      expect(flattenSpecialties(['Systems Design'])).toEqual(['Systems Design'])
    })
  })

  describe('totalCoursesForAuthor', () => {
    it('sums canonical and imported rows for authorId', () => {
      const n = totalCoursesForAuthor(
        'a1',
        [{ authorId: 'a1' } as never, { authorId: 'a2' } as never],
        [{ authorId: 'a1' } as never, { authorId: 'a1' } as never]
      )
      expect(n).toBe(3)
    })

    it('ignores imported courses with missing authorId', () => {
      const n = totalCoursesForAuthor(
        'a1',
        [],
        [{ authorId: undefined } as never, { id: 'x' } as never]
      )
      expect(n).toBe(0)
    })
  })

  describe('withAuthorCourseCounts', () => {
    it('overrides AuthorView courseCount with canonical plus imported totals', () => {
      mockCourseStoreGetState.mockReturnValue({
        courses: [
          { authorId: 'a1', totalLessons: 1, estimatedHours: 1, totalVideos: 1, category: 'X' },
        ],
      })
      const base = getMergedAuthors([
        {
          id: 'a1',
          name: 'Ann',
          bio: 'Bio',
          isPreseeded: false,
          createdAt: '2026-01-01',
        },
      ] as never[])
      expect(base[0].courseCount).toBe(1)
      const enriched = withAuthorCourseCounts(
        base,
        [{ authorId: 'a1' } as never, { authorId: 'a1' } as never],
        [{ authorId: 'a1' } as never]
      )
      expect(enriched[0].courseCount).toBe(3)
    })
  })

  describe('getAuthorStats', () => {
    it('computes stats from matching courses', () => {
      mockCourseStoreGetState.mockReturnValue({
        courses: [
          { authorId: 'a1', totalLessons: 10, estimatedHours: 5, totalVideos: 8, category: 'Math' },
          {
            authorId: 'a1',
            totalLessons: 5,
            estimatedHours: 3,
            totalVideos: 4,
            category: 'Science',
          },
        ],
      })

      const stats = getAuthorStats({ id: 'a1' } as never)
      expect(stats.courseCount).toBe(2)
      expect(stats.totalLessons).toBe(15)
      expect(stats.totalHours).toBe(8)
      expect(stats.totalVideos).toBe(12)
      expect(stats.categories).toEqual(['Math', 'Science'])
    })

    it('returns zeros when no matching courses', () => {
      mockCourseStoreGetState.mockReturnValue({ courses: [] })
      const stats = getAuthorStats({ id: 'none' } as never)
      expect(stats.courseCount).toBe(0)
    })
  })

  describe('getImportedAuthorStats', () => {
    it('computes stats from matching courses', () => {
      mockCourseStoreGetState.mockReturnValue({
        courses: [
          { authorId: 'a1', totalLessons: 10, estimatedHours: 5, totalVideos: 8, category: 'Math' },
        ],
      })
      const stats = getImportedAuthorStats({ id: 'a1' } as never)
      expect(stats.courseCount).toBe(1)
    })
  })

  describe('getAuthorForCourse', () => {
    it('returns author when found', () => {
      mockAuthorStoreGetState.mockReturnValue({
        isLoaded: true,
        isLoading: false,
        loadAuthors: vi.fn(),
        getAuthorById: vi.fn(() => ({ id: 'a1', name: 'Author', photoUrl: '/photo.jpg' })),
      } as any)

      const result = getAuthorForCourse({ authorId: 'a1' } as never)
      expect(result).toEqual({ id: 'a1', name: 'Author', avatar: '/photo.jpg' })
    })

    it('returns undefined when author not found', () => {
      mockAuthorStoreGetState.mockReturnValue({
        isLoaded: true,
        isLoading: false,
        loadAuthors: vi.fn(),
        getAuthorById: vi.fn(() => null),
      })

      const result = getAuthorForCourse({ authorId: 'missing' } as never)
      expect(result).toBeUndefined()
    })

    it('triggers loadAuthors when not loaded', () => {
      const loadAuthors = vi.fn()
      mockAuthorStoreGetState.mockReturnValue({
        isLoaded: false,
        isLoading: false,
        loadAuthors,
        getAuthorById: vi.fn(() => null),
      })

      getAuthorForCourse({ authorId: 'a1' } as never)
      expect(loadAuthors).toHaveBeenCalled()
    })
  })

  describe('getAuthorForImportedCourse', () => {
    it('returns undefined when authorId is undefined', () => {
      expect(getAuthorForImportedCourse(undefined)).toBeUndefined()
    })

    it('returns author when found', () => {
      mockAuthorStoreGetState.mockReturnValue({
        isLoaded: true,
        isLoading: false,
        loadAuthors: vi.fn(),
        getAuthorById: vi.fn(() => ({ id: 'a1', name: 'Author', photoUrl: null as string | null })),
      } as any)

      const result = getAuthorForImportedCourse('a1')
      expect(result).toEqual({ id: 'a1', name: 'Author', avatar: '' })
    })
  })
})

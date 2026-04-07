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

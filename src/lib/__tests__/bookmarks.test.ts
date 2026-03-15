import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

type BookmarksModule = typeof import('@/lib/bookmarks')
let bookmarksLib: BookmarksModule

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  localStorage.clear()
  bookmarksLib = await import('@/lib/bookmarks')
})

describe('addBookmark', () => {
  it('returns a bookmark id string', async () => {
    const id = await bookmarksLib.addBookmark('c1', 'l1', 90, 'My label')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('stores bookmark with correct fields', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 90.7, 'Test label')
    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0]).toMatchObject({
      courseId: 'c1',
      lessonId: 'l1',
      timestamp: 90, // Math.floor applied
      label: 'Test label',
    })
    expect(bookmarks[0].createdAt).toBeTruthy()
  })

  it('uses formatted timestamp as default label when no label provided', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 125)
    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    // 125 seconds = 2:05
    expect(bookmarks[0].label).toBe('2:05')
  })

  it('uses formatted timestamp when empty string label provided', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 3661, '')
    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    // 3661 seconds = 1:01:01
    expect(bookmarks[0].label).toBe('1:01:01')
  })

  it('floors timestamp to integer', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 45.9, 'Floored')
    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(bookmarks[0].timestamp).toBe(45)
  })
})

describe('getLessonBookmarks', () => {
  it('returns empty array when no bookmarks exist', async () => {
    const result = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(result).toEqual([])
  })

  it('returns bookmarks sorted by timestamp ascending', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 300, 'Late')
    await bookmarksLib.addBookmark('c1', 'l1', 10, 'Early')
    await bookmarksLib.addBookmark('c1', 'l1', 150, 'Middle')

    const result = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(result.map(b => b.label)).toEqual(['Early', 'Middle', 'Late'])
  })

  it('filters by both courseId and lessonId', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 10, 'Match')
    await bookmarksLib.addBookmark('c1', 'l2', 20, 'Wrong lesson')
    await bookmarksLib.addBookmark('c2', 'l1', 30, 'Wrong course')

    const result = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Match')
  })
})

describe('getCourseBookmarks', () => {
  it('returns empty array when no bookmarks exist', async () => {
    const result = await bookmarksLib.getCourseBookmarks('c1')
    expect(result).toEqual([])
  })

  it('returns all bookmarks for a course across lessons', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 10, 'L1')
    await bookmarksLib.addBookmark('c1', 'l2', 20, 'L2')
    await bookmarksLib.addBookmark('c2', 'l1', 30, 'Other course')

    const result = await bookmarksLib.getCourseBookmarks('c1')
    expect(result).toHaveLength(2)
    expect(result.map(b => b.label)).toEqual(['L1', 'L2'])
  })

  it('returns bookmarks sorted by timestamp ascending', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 200, 'Second')
    await bookmarksLib.addBookmark('c1', 'l2', 50, 'First')

    const result = await bookmarksLib.getCourseBookmarks('c1')
    expect(result[0].label).toBe('First')
    expect(result[1].label).toBe('Second')
  })
})

describe('updateBookmarkLabel', () => {
  it('returns true when bookmark is updated', async () => {
    const id = await bookmarksLib.addBookmark('c1', 'l1', 60, 'Original')
    const result = await bookmarksLib.updateBookmarkLabel(id, 'Updated')
    expect(result).toBe(true)
  })

  it('persists the updated label', async () => {
    const id = await bookmarksLib.addBookmark('c1', 'l1', 60, 'Original')
    await bookmarksLib.updateBookmarkLabel(id, 'New label')

    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(bookmarks[0].label).toBe('New label')
  })

  it('returns false for non-existent bookmark', async () => {
    const result = await bookmarksLib.updateBookmarkLabel('nonexistent-id', 'Label')
    expect(result).toBe(false)
  })
})

describe('deleteBookmark', () => {
  it('removes the bookmark', async () => {
    const id = await bookmarksLib.addBookmark('c1', 'l1', 60, 'To delete')
    await bookmarksLib.deleteBookmark(id)

    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(bookmarks).toHaveLength(0)
  })

  it('does not throw for non-existent bookmark', async () => {
    await expect(bookmarksLib.deleteBookmark('nonexistent')).resolves.toBeUndefined()
  })
})

describe('hasBookmarkAt', () => {
  it('returns true when bookmark exists at exact timestamp', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 60, 'Exact')
    const result = await bookmarksLib.hasBookmarkAt('c1', 'l1', 60)
    expect(result).toBe(true)
  })

  it('returns true within 1 second tolerance', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 60, 'Close')
    expect(await bookmarksLib.hasBookmarkAt('c1', 'l1', 60.5)).toBe(true)
    expect(await bookmarksLib.hasBookmarkAt('c1', 'l1', 59.5)).toBe(true)
  })

  it('returns false beyond 1 second tolerance', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 60, 'Far')
    expect(await bookmarksLib.hasBookmarkAt('c1', 'l1', 62)).toBe(false)
    expect(await bookmarksLib.hasBookmarkAt('c1', 'l1', 58)).toBe(false)
  })

  it('returns false when no bookmarks exist', async () => {
    const result = await bookmarksLib.hasBookmarkAt('c1', 'l1', 60)
    expect(result).toBe(false)
  })

  it('respects courseId and lessonId filtering', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 60, 'Only here')
    expect(await bookmarksLib.hasBookmarkAt('c1', 'l2', 60)).toBe(false)
    expect(await bookmarksLib.hasBookmarkAt('c2', 'l1', 60)).toBe(false)
  })
})

describe('formatBookmarkTimestamp', () => {
  it('formats seconds to MM:SS', () => {
    expect(bookmarksLib.formatBookmarkTimestamp(125)).toBe('2:05')
  })

  it('formats seconds to HH:MM:SS for long timestamps', () => {
    expect(bookmarksLib.formatBookmarkTimestamp(3661)).toBe('1:01:01')
  })

  it('formats 0 seconds', () => {
    expect(bookmarksLib.formatBookmarkTimestamp(0)).toBe('0:00')
  })
})

describe('getAllBookmarks', () => {
  it('returns empty array when no bookmarks exist', async () => {
    const result = await bookmarksLib.getAllBookmarks()
    expect(result).toEqual([])
  })

  it('returns bookmarks sorted by most recently created first', async () => {
    // Add 3 bookmarks with different createdAt timestamps
    await bookmarksLib.addBookmark('course-a', 'lesson-1', 60, 'First')
    // Small delay to ensure distinct createdAt
    await new Promise(r => setTimeout(r, 10))
    await bookmarksLib.addBookmark('course-b', 'lesson-2', 120, 'Second')
    await new Promise(r => setTimeout(r, 10))
    await bookmarksLib.addBookmark('course-a', 'lesson-3', 180, 'Third')

    const result = await bookmarksLib.getAllBookmarks()

    expect(result).toHaveLength(3)
    // Most recently created should be first
    expect(result[0].label).toBe('Third')
    expect(result[1].label).toBe('Second')
    expect(result[2].label).toBe('First')
  })

  it('includes bookmarks from all courses', async () => {
    await bookmarksLib.addBookmark('course-a', 'lesson-1', 60)
    await bookmarksLib.addBookmark('course-b', 'lesson-2', 120)

    const result = await bookmarksLib.getAllBookmarks()

    expect(result).toHaveLength(2)
    const courseIds = result.map(b => b.courseId)
    expect(courseIds).toContain('course-a')
    expect(courseIds).toContain('course-b')
  })

  it('excludes deleted bookmarks from getAllBookmarks', async () => {
    const id1 = await bookmarksLib.addBookmark('course-a', 'lesson-1', 60, 'Keep')
    await bookmarksLib.addBookmark('course-a', 'lesson-2', 120, 'Also keep')
    const id3 = await bookmarksLib.addBookmark('course-b', 'lesson-3', 180, 'Delete me')

    await bookmarksLib.deleteBookmark(id3)
    await bookmarksLib.deleteBookmark(id1)

    const result = await bookmarksLib.getAllBookmarks()

    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Also keep')
  })
})

describe('getTotalBookmarkCount', () => {
  it('returns 0 when no bookmarks exist', async () => {
    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(0)
  })

  it('returns correct count across courses', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 10)
    await bookmarksLib.addBookmark('c2', 'l2', 20)
    await bookmarksLib.addBookmark('c1', 'l3', 30)

    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(3)
  })
})

describe('clearAllBookmarks', () => {
  it('removes all bookmarks', async () => {
    await bookmarksLib.addBookmark('c1', 'l1', 10)
    await bookmarksLib.addBookmark('c2', 'l2', 20)

    await bookmarksLib.clearAllBookmarks()

    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(0)
  })

  it('does not throw when already empty', async () => {
    await expect(bookmarksLib.clearAllBookmarks()).resolves.toBeUndefined()
  })
})

describe('migrateBookmarksFromLocalStorage', () => {
  it('does nothing when localStorage key does not exist', async () => {
    await bookmarksLib.migrateBookmarksFromLocalStorage()
    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(0)
  })

  it('does nothing when localStorage has empty array', async () => {
    localStorage.setItem('video-bookmarks', '[]')
    await bookmarksLib.migrateBookmarksFromLocalStorage()
    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(0)
  })

  it('migrates bookmarks from localStorage to IndexedDB', async () => {
    const legacyBookmarks = [
      {
        id: 'b1',
        courseId: 'c1',
        lessonId: 'l1',
        timestamp: 60,
        label: 'Migrated',
        createdAt: '2025-01-15T12:00:00.000Z',
      },
      {
        id: 'b2',
        courseId: 'c1',
        lessonId: 'l2',
        timestamp: 120,
        label: 'Also migrated',
        createdAt: '2025-01-15T12:01:00.000Z',
      },
    ]
    localStorage.setItem('video-bookmarks', JSON.stringify(legacyBookmarks))

    await bookmarksLib.migrateBookmarksFromLocalStorage()

    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(2)
    const all = await bookmarksLib.getAllBookmarks()
    expect(all.map(b => b.label)).toContain('Migrated')
    expect(all.map(b => b.label)).toContain('Also migrated')
  })

  it('adds default label from timestamp when legacy bookmark has no label', async () => {
    const legacyBookmarks = [
      {
        id: 'b1',
        courseId: 'c1',
        lessonId: 'l1',
        timestamp: 125,
        label: '',
        createdAt: '2025-01-15T12:00:00.000Z',
      },
    ]
    localStorage.setItem('video-bookmarks', JSON.stringify(legacyBookmarks))

    await bookmarksLib.migrateBookmarksFromLocalStorage()

    const bookmarks = await bookmarksLib.getLessonBookmarks('c1', 'l1')
    expect(bookmarks[0].label).toBe('2:05')
  })

  it('handles invalid JSON gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('video-bookmarks', 'not valid json')

    await bookmarksLib.migrateBookmarksFromLocalStorage()

    const count = await bookmarksLib.getTotalBookmarkCount()
    expect(count).toBe(0)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('retains localStorage after migration (backup)', async () => {
    const legacyBookmarks = [
      {
        id: 'b1',
        courseId: 'c1',
        lessonId: 'l1',
        timestamp: 60,
        label: 'Keep in LS',
        createdAt: '2025-01-15T12:00:00.000Z',
      },
    ]
    localStorage.setItem('video-bookmarks', JSON.stringify(legacyBookmarks))

    await bookmarksLib.migrateBookmarksFromLocalStorage()

    expect(localStorage.getItem('video-bookmarks')).not.toBeNull()
  })

  it('is idempotent - second call does not duplicate', async () => {
    const legacyBookmarks = [
      {
        id: 'b1',
        courseId: 'c1',
        lessonId: 'l1',
        timestamp: 60,
        label: 'Once',
        createdAt: '2025-01-15T12:00:00.000Z',
      },
    ]
    localStorage.setItem('video-bookmarks', JSON.stringify(legacyBookmarks))

    await bookmarksLib.migrateBookmarksFromLocalStorage()
    await bookmarksLib.migrateBookmarksFromLocalStorage()

    const count = await bookmarksLib.getTotalBookmarkCount()
    // bulkPut is idempotent for same IDs
    expect(count).toBe(1)
  })
})

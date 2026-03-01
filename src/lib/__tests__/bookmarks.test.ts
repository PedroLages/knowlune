import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

type BookmarksModule = typeof import('@/lib/bookmarks')
let bookmarksLib: BookmarksModule

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  bookmarksLib = await import('@/lib/bookmarks')
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

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

let useBookmarkStore: (typeof import('@/stores/useBookmarkStore'))['useBookmarkStore']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const mod = await import('@/stores/useBookmarkStore')
  useBookmarkStore = mod.useBookmarkStore
})

describe('useBookmarkStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useBookmarkStore.getState()
    expect(state.bookmarks).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('addBookmark', () => {
  it('should add a bookmark optimistically', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('course-1', 'lesson-1', 120, 'Key point')
    })

    const state = useBookmarkStore.getState()
    expect(state.bookmarks).toHaveLength(1)
    expect(state.bookmarks[0].label).toBe('Key point')
    expect(state.bookmarks[0].timestamp).toBe(120)
    expect(state.error).toBeNull()
  })

  it('should persist bookmark to IndexedDB', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('course-1', 'lesson-1', 60)
    })

    const { db } = await import('@/db')
    const all = await db.bookmarks.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].timestamp).toBe(60)
  })

  it('should auto-generate label from timestamp when not provided', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('course-1', 'lesson-1', 125) // 2:05
    })

    const state = useBookmarkStore.getState()
    expect(state.bookmarks[0].label).toBe('2:05')
  })

  it('should sort bookmarks by timestamp', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('c1', 'l1', 300, 'Later')
      await useBookmarkStore.getState().addBookmark('c1', 'l1', 60, 'Earlier')
    })

    const state = useBookmarkStore.getState()
    expect(state.bookmarks[0].label).toBe('Earlier')
    expect(state.bookmarks[1].label).toBe('Later')
  })
})

describe('updateBookmarkLabel', () => {
  it('should update label optimistically', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('c1', 'l1', 90, 'Old label')
    })

    const bookmarkId = useBookmarkStore.getState().bookmarks[0].id

    await act(async () => {
      await useBookmarkStore.getState().updateBookmarkLabel(bookmarkId, 'New label')
    })

    expect(useBookmarkStore.getState().bookmarks[0].label).toBe('New label')
  })

  it('should persist label change to IndexedDB', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('c1', 'l1', 90, 'Before')
    })

    const bookmarkId = useBookmarkStore.getState().bookmarks[0].id

    await act(async () => {
      await useBookmarkStore.getState().updateBookmarkLabel(bookmarkId, 'After')
    })

    const { db } = await import('@/db')
    const stored = await db.bookmarks.get(bookmarkId)
    expect(stored!.label).toBe('After')
  })
})

describe('deleteBookmark', () => {
  it('should remove bookmark from state', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('c1', 'l1', 30, 'To delete')
    })

    const bookmarkId = useBookmarkStore.getState().bookmarks[0].id

    await act(async () => {
      await useBookmarkStore.getState().deleteBookmark(bookmarkId)
    })

    expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
  })

  it('should remove bookmark from IndexedDB', async () => {
    await act(async () => {
      await useBookmarkStore.getState().addBookmark('c1', 'l1', 30)
    })

    const bookmarkId = useBookmarkStore.getState().bookmarks[0].id

    await act(async () => {
      await useBookmarkStore.getState().deleteBookmark(bookmarkId)
    })

    const { db } = await import('@/db')
    const stored = await db.bookmarks.get(bookmarkId)
    expect(stored).toBeUndefined()
  })
})

describe('loadLessonBookmarks', () => {
  it('should load bookmarks filtered by course and lesson', async () => {
    const { db } = await import('@/db')
    await db.bookmarks.bulkAdd([
      {
        id: '1',
        courseId: 'c1',
        lessonId: 'l1',
        timestamp: 10,
        label: '0:10',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        courseId: 'c1',
        lessonId: 'l2',
        timestamp: 20,
        label: '0:20',
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        courseId: 'c2',
        lessonId: 'l1',
        timestamp: 30,
        label: '0:30',
        createdAt: new Date().toISOString(),
      },
    ])

    await act(async () => {
      await useBookmarkStore.getState().loadLessonBookmarks('c1', 'l1')
    })

    expect(useBookmarkStore.getState().bookmarks).toHaveLength(1)
    expect(useBookmarkStore.getState().bookmarks[0].id).toBe('1')
  })
})

describe('getTotalCount', () => {
  it('should return total bookmark count from IndexedDB', async () => {
    const { db } = await import('@/db')
    await db.bookmarks.bulkAdd([
      {
        id: '1',
        courseId: 'c1',
        lessonId: 'l1',
        timestamp: 10,
        label: '0:10',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        courseId: 'c1',
        lessonId: 'l2',
        timestamp: 20,
        label: '0:20',
        createdAt: new Date().toISOString(),
      },
    ])

    const count = await useBookmarkStore.getState().getTotalCount()
    expect(count).toBe(2)
  })
})

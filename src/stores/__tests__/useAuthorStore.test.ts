import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'

// Mock persistWithRetry to run operation once (no retries).
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: async (op: () => Promise<void>) => op(),
}))

// Mock sonner toast for error assertions
vi.mock('sonner', () => {
  const toastFn = vi.fn() as ReturnType<typeof vi.fn> & {
    error: ReturnType<typeof vi.fn>
    success: ReturnType<typeof vi.fn>
    custom: ReturnType<typeof vi.fn>
    promise: ReturnType<typeof vi.fn>
  }
  toastFn.error = vi.fn()
  toastFn.success = vi.fn()
  toastFn.custom = vi.fn()
  toastFn.promise = vi.fn()
  return { toast: toastFn }
})

// Import store AFTER mock is set up
const { useAuthorStore } = await import('@/stores/useAuthorStore')

beforeEach(async () => {
  vi.restoreAllMocks()
  useAuthorStore.setState({ authors: [], isLoading: false, error: null })
  const { db } = await import('@/db')
  await db.authors.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAuthorStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useAuthorStore.getState()
    expect(state.authors).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})

describe('addAuthor', () => {
  it('should add an author optimistically', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Jane Doe',
        bio: 'Expert in TypeScript',
        photoUrl: 'https://example.com/photo.jpg',
      })
    })

    const state = useAuthorStore.getState()
    expect(state.authors).toHaveLength(1)
    expect(state.authors[0].name).toBe('Jane Doe')
    expect(state.authors[0].bio).toBe('Expert in TypeScript')
    expect(state.authors[0].photoUrl).toBe('https://example.com/photo.jpg')
    expect(state.authors[0].courseIds).toEqual([])
    expect(state.error).toBeNull()
    expect(state.authors[0].id).toBeTruthy()
  })

  it('should persist author to IndexedDB with correct fields', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'John Smith',
        bio: 'React developer',
        photoUrl: '',
        courseIds: ['course-1'],
      })
    })

    const { db } = await import('@/db')
    const all = await db.authors.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBeTruthy()
    expect(all[0].name).toBe('John Smith')
    expect(all[0].bio).toBe('React developer')
    expect(all[0].courseIds).toEqual(['course-1'])
    expect(all[0].createdAt).toBeTruthy()
    expect(all[0].updatedAt).toBeTruthy()
  })

  it('should generate a UUID id and ISO timestamps', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Test Author',
        bio: 'Test bio',
        photoUrl: '',
      })
    })

    const author = useAuthorStore.getState().authors[0]
    expect(author.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(new Date(author.createdAt).toISOString()).toBe(author.createdAt)
    expect(new Date(author.updatedAt).toISOString()).toBe(author.updatedAt)
  })

  it('should rollback on persistence failure', async () => {
    const { db } = await import('@/db')
    vi.spyOn(db.authors, 'add').mockRejectedValue(new Error('DB write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      useAuthorStore.getState().addAuthor({
        name: 'Fail author',
        bio: 'Should not persist',
        photoUrl: '',
      })
    ).rejects.toThrow('DB write failed')

    const state = useAuthorStore.getState()
    expect(state.authors).toHaveLength(0)
    expect(state.error).toBe('Failed to create author')
  })
})

describe('updateAuthor', () => {
  it('should update author fields', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Original Name',
        bio: 'Original bio',
        photoUrl: '',
      })
    })

    const id = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().updateAuthor(id, {
        name: 'Updated Name',
        bio: 'Updated bio',
      })
    })

    const state = useAuthorStore.getState()
    expect(state.authors[0].name).toBe('Updated Name')
    expect(state.authors[0].bio).toBe('Updated bio')
  })

  it('should update updatedAt timestamp', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Test',
        bio: '',
        photoUrl: '',
      })
    })

    const originalUpdatedAt = useAuthorStore.getState().authors[0].updatedAt
    const id = useAuthorStore.getState().authors[0].id

    // Small delay to ensure different timestamp
    await new Promise(r => setTimeout(r, 10))

    await act(async () => {
      await useAuthorStore.getState().updateAuthor(id, { name: 'Updated' })
    })

    expect(useAuthorStore.getState().authors[0].updatedAt).not.toBe(originalUpdatedAt)
  })

  it('should persist update to IndexedDB', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Before Update',
        bio: '',
        photoUrl: '',
      })
    })

    const id = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().updateAuthor(id, { name: 'After Update' })
    })

    const { db } = await import('@/db')
    const dbAuthor = await db.authors.get(id)
    expect(dbAuthor?.name).toBe('After Update')
  })

  it('should rollback on persistence failure', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Sticky Name',
        bio: '',
        photoUrl: '',
      })
    })

    const { db } = await import('@/db')
    const id = useAuthorStore.getState().authors[0].id
    vi.spyOn(db.authors, 'put').mockRejectedValue(new Error('DB write failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      useAuthorStore.getState().updateAuthor(id, { name: 'Should Fail' })
    ).rejects.toThrow('DB write failed')

    const state = useAuthorStore.getState()
    expect(state.authors[0].name).toBe('Sticky Name')
    expect(state.error).toBe('Failed to update author')
  })

  it('should no-op for non-existent author', async () => {
    await act(async () => {
      await useAuthorStore.getState().updateAuthor('non-existent', { name: 'Ghost' })
    })

    expect(useAuthorStore.getState().authors).toHaveLength(0)
  })
})

describe('deleteAuthor', () => {
  it('should remove author from state', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'To delete',
        bio: '',
        photoUrl: '',
      })
    })

    const id = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().deleteAuthor(id)
    })

    expect(useAuthorStore.getState().authors).toHaveLength(0)
  })

  it('should remove author from IndexedDB', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Persist then delete',
        bio: '',
        photoUrl: '',
      })
    })

    const { db } = await import('@/db')
    const id = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().deleteAuthor(id)
    })

    const remaining = await db.authors.toArray()
    expect(remaining).toHaveLength(0)
  })

  it('should rollback and toast on persistence failure', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Sticky author',
        bio: '',
        photoUrl: '',
      })
    })

    const { db } = await import('@/db')
    const id = useAuthorStore.getState().authors[0].id
    vi.spyOn(db.authors, 'delete').mockRejectedValue(new Error('DB delete failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(useAuthorStore.getState().deleteAuthor(id)).rejects.toThrow('DB delete failed')

    const state = useAuthorStore.getState()
    expect(state.authors).toHaveLength(1)
    expect(state.authors[0].name).toBe('Sticky author')
    expect(state.error).toBe('Failed to delete author')
  })
})

describe('loadAuthors', () => {
  it('should load authors from IndexedDB', async () => {
    const { db } = await import('@/db')
    const now = new Date().toISOString()
    await db.authors.add({
      id: crypto.randomUUID(),
      name: 'Preexisting author',
      bio: 'A bio',
      photoUrl: '',
      courseIds: [],
      isPreseeded: false,
      createdAt: now,
      updatedAt: now,
    })

    await act(async () => {
      await useAuthorStore.getState().loadAuthors()
    })

    const state = useAuthorStore.getState()
    expect(state.authors).toHaveLength(1)
    expect(state.authors[0].name).toBe('Preexisting author')
    expect(state.isLoading).toBe(false)
  })

  it('should set error on failure', async () => {
    const { db } = await import('@/db')
    vi.spyOn(db.authors, 'orderBy').mockImplementation(() => {
      throw new Error('DB read failed')
    })

    await act(async () => {
      await useAuthorStore.getState().loadAuthors()
    })

    const state = useAuthorStore.getState()
    expect(state.error).toBe('Failed to load authors')
    expect(state.isLoading).toBe(false)
  })
})

describe('getAuthorById', () => {
  it('should return the author with matching id', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Find Me',
        bio: '',
        photoUrl: '',
      })
    })

    const id = useAuthorStore.getState().authors[0].id
    const found = useAuthorStore.getState().getAuthorById(id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Find Me')
  })

  it('should return undefined for non-existent id', () => {
    const found = useAuthorStore.getState().getAuthorById('non-existent')
    expect(found).toBeUndefined()
  })
})

describe('linkCourseToAuthor', () => {
  it('should add courseId to author courseIds', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Link test',
        bio: '',
        photoUrl: '',
      })
    })

    const authorId = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().linkCourseToAuthor(authorId, 'course-abc')
    })

    const state = useAuthorStore.getState()
    expect(state.authors[0].courseIds).toContain('course-abc')

    // Verify persisted
    const { db } = await import('@/db')
    const dbAuthor = await db.authors.get(authorId)
    expect(dbAuthor?.courseIds).toContain('course-abc')
  })

  it('should not duplicate existing courseId', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Dup test',
        bio: '',
        photoUrl: '',
        courseIds: ['course-1'],
      })
    })

    const authorId = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().linkCourseToAuthor(authorId, 'course-1')
    })

    expect(useAuthorStore.getState().authors[0].courseIds).toEqual(['course-1'])
  })

  it('should no-op for non-existent author', async () => {
    await act(async () => {
      await useAuthorStore.getState().linkCourseToAuthor('non-existent', 'course-1')
    })

    expect(useAuthorStore.getState().authors).toHaveLength(0)
  })
})

describe('unlinkCourseFromAuthor', () => {
  it('should remove courseId from author courseIds', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'Unlink test',
        bio: '',
        photoUrl: '',
        courseIds: ['course-1', 'course-2'],
      })
    })

    const authorId = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().unlinkCourseFromAuthor(authorId, 'course-1')
    })

    const state = useAuthorStore.getState()
    expect(state.authors[0].courseIds).toEqual(['course-2'])

    // Verify persisted
    const { db } = await import('@/db')
    const dbAuthor = await db.authors.get(authorId)
    expect(dbAuthor?.courseIds).toEqual(['course-2'])
  })

  it('should no-op when courseId not linked', async () => {
    await act(async () => {
      await useAuthorStore.getState().addAuthor({
        name: 'No-op test',
        bio: '',
        photoUrl: '',
        courseIds: ['course-1'],
      })
    })

    const authorId = useAuthorStore.getState().authors[0].id

    await act(async () => {
      await useAuthorStore.getState().unlinkCourseFromAuthor(authorId, 'non-existent')
    })

    expect(useAuthorStore.getState().authors[0].courseIds).toEqual(['course-1'])
  })
})

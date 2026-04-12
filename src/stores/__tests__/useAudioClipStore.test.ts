import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

let useAudioClipStore: (typeof import('@/stores/useAudioClipStore'))['useAudioClipStore']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const mod = await import('@/stores/useAudioClipStore')
  useAudioClipStore = mod.useAudioClipStore
})

const BASE_CLIP = {
  bookId: 'book-1',
  chapterId: 'Chapter One',
  chapterIndex: 0,
  startTime: 10,
  endTime: 30,
}

describe('useAudioClipStore initial state', () => {
  it('has empty initial state', () => {
    const state = useAudioClipStore.getState()
    expect(state.clips).toEqual([])
    expect(state.isLoaded).toBe(false)
    expect(state.loadedBookId).toBeNull()
  })
})

describe('loadClips', () => {
  it('loads clips from Dexie and sets isLoaded', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    // Reset loaded state to force reload
    useAudioClipStore.setState({ isLoaded: false, loadedBookId: null })

    await act(async () => {
      await useAudioClipStore.getState().loadClips('book-1')
    })

    const state = useAudioClipStore.getState()
    expect(state.clips).toHaveLength(1)
    expect(state.isLoaded).toBe(true)
    expect(state.loadedBookId).toBe('book-1')
  })

  it('skips reload when same bookId is already loaded', async () => {
    await act(async () => {
      await useAudioClipStore.getState().loadClips('book-1')
    })
    expect(useAudioClipStore.getState().isLoaded).toBe(true)

    // Second load should be a no-op
    const dbSpy = vi.spyOn((await import('@/db/schema')).db.audioClips, 'where')
    await act(async () => {
      await useAudioClipStore.getState().loadClips('book-1')
    })
    expect(dbSpy).not.toHaveBeenCalled()
  })

  it('reloads when a different bookId is requested', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, bookId: 'book-2' })
      await useAudioClipStore.getState().loadClips('book-1')
    })

    useAudioClipStore.setState({ isLoaded: false, loadedBookId: null })

    await act(async () => {
      await useAudioClipStore.getState().loadClips('book-2')
    })

    const state = useAudioClipStore.getState()
    expect(state.loadedBookId).toBe('book-2')
    expect(state.clips).toHaveLength(1)
    expect(state.clips[0].bookId).toBe('book-2')
  })
})

describe('addClip', () => {
  it('adds a clip optimistically with sortOrder', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    const state = useAudioClipStore.getState()
    expect(state.clips).toHaveLength(1)
    expect(state.clips[0].startTime).toBe(10)
    expect(state.clips[0].endTime).toBe(30)
    expect(state.clips[0].sortOrder).toBe(0)
  })

  it('assigns incrementing sortOrder for multiple clips', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, startTime: 60, endTime: 90 })
    })

    const { clips } = useAudioClipStore.getState()
    expect(clips[0].sortOrder).toBe(0)
    expect(clips[1].sortOrder).toBe(1)
  })

  it('persists clip to IndexedDB', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    const { db } = await import('@/db/schema')
    const all = await db.audioClips.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].startTime).toBe(10)
  })

  it('returns the new clip id', async () => {
    let id: string | undefined
    await act(async () => {
      id = await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })
})

describe('updateClipTitle', () => {
  it('updates clip title optimistically', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    const clipId = useAudioClipStore.getState().clips[0].id

    await act(async () => {
      await useAudioClipStore.getState().updateClipTitle(clipId, 'My Clip')
    })

    const { clips } = useAudioClipStore.getState()
    expect(clips[0].title).toBe('My Clip')
  })

  it('persists title update to IndexedDB', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    const clipId = useAudioClipStore.getState().clips[0].id

    await act(async () => {
      await useAudioClipStore.getState().updateClipTitle(clipId, 'Persisted Title')
    })

    const { db } = await import('@/db/schema')
    const record = await db.audioClips.get(clipId)
    expect(record?.title).toBe('Persisted Title')
  })
})

describe('deleteClip', () => {
  it('removes clip from state optimistically', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    const clipId = useAudioClipStore.getState().clips[0].id

    await act(async () => {
      await useAudioClipStore.getState().deleteClip(clipId)
    })

    expect(useAudioClipStore.getState().clips).toHaveLength(0)
  })

  it('removes clip from IndexedDB', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip(BASE_CLIP)
    })

    const clipId = useAudioClipStore.getState().clips[0].id

    await act(async () => {
      await useAudioClipStore.getState().deleteClip(clipId)
    })

    const { db } = await import('@/db/schema')
    const record = await db.audioClips.get(clipId)
    expect(record).toBeUndefined()
  })
})

describe('reorderClips', () => {
  it('reorders clips using arrayMove and updates sortOrder', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, startTime: 0 })
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, startTime: 60 })
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, startTime: 120 })
    })

    const beforeIds = useAudioClipStore.getState().clips.map(c => c.id)

    await act(async () => {
      await useAudioClipStore.getState().reorderClips(0, 2)
    })

    const { clips } = useAudioClipStore.getState()
    // First item should now be what was index 1 before
    expect(clips[0].id).toBe(beforeIds[1])
    expect(clips[0].sortOrder).toBe(0)
    expect(clips[2].sortOrder).toBe(2)
  })

  it('persists new sortOrder values to IndexedDB', async () => {
    await act(async () => {
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, startTime: 0 })
      await useAudioClipStore.getState().addClip({ ...BASE_CLIP, startTime: 60 })
    })

    await act(async () => {
      await useAudioClipStore.getState().reorderClips(0, 1)
    })

    const { db } = await import('@/db/schema')
    const all = await db.audioClips.orderBy('sortOrder').toArray()
    expect(all[0].sortOrder).toBe(0)
    expect(all[1].sortOrder).toBe(1)
  })
})

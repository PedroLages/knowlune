import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

let useCourseStore: (typeof import('@/stores/useCourseStore'))['useCourseStore']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const mod = await import('@/stores/useCourseStore')
  useCourseStore = mod.useCourseStore
})

describe('useCourseStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useCourseStore.getState()
    expect(state.courses).toEqual([])
    expect(state.isLoaded).toBe(false)
  })
})

describe('loadCourses', () => {
  it('should load courses from IndexedDB', async () => {
    const { db } = await import('@/db')
    await db.courses.bulkAdd([
      { id: 'c1', title: 'Course 1', description: '', image: '', category: 'behavioral-analysis', rating: 0, author: '', duration: '' } as never,
      { id: 'c2', title: 'Course 2', description: '', image: '', category: 'behavioral-analysis', rating: 0, author: '', duration: '' } as never,
    ])

    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })

    const state = useCourseStore.getState()
    expect(state.courses).toHaveLength(2)
    expect(state.isLoaded).toBe(true)
  })

  it('should skip loading if already loaded with courses', async () => {
    const { db } = await import('@/db')
    await db.courses.add({ id: 'c1', title: 'Course 1', description: '', image: '', category: 'behavioral-analysis', rating: 0, author: '', duration: '' } as never)

    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })
    expect(useCourseStore.getState().courses).toHaveLength(1)

    // Add more to DB but load should skip (already loaded)
    await db.courses.add({ id: 'c2', title: 'Course 2', description: '', image: '', category: 'behavioral-analysis', rating: 0, author: '', duration: '' } as never)

    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })

    // Still 1 because it skipped the second load
    expect(useCourseStore.getState().courses).toHaveLength(1)
  })

  it('should load even when isLoaded=true but courses array is empty', async () => {
    useCourseStore.setState({ isLoaded: true, courses: [] })

    const { db } = await import('@/db')
    await db.courses.add({ id: 'c1', title: 'Course 1', description: '', image: '', category: 'behavioral-analysis', rating: 0, author: '', duration: '' } as never)

    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })

    expect(useCourseStore.getState().courses).toHaveLength(1)
  })

  it('should handle DB errors gracefully', async () => {
    const { db } = await import('@/db')
    vi.spyOn(db.courses, 'toArray').mockRejectedValue(new Error('DB error'))

    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })

    // Should not crash — state unchanged
    expect(useCourseStore.getState().courses).toEqual([])
  })

  it('should set isLoaded even when no courses returned', async () => {
    // Empty DB — toArray returns []
    await act(async () => {
      await useCourseStore.getState().loadCourses()
    })

    const state = useCourseStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.courses).toEqual([])
  })
})

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import { createStudySession as makeSession } from '../../../tests/support/fixtures/factories/session-factory'

let useSessionStore: (typeof import('@/stores/useSessionStore'))['useSessionStore']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const mod = await import('@/stores/useSessionStore')
  useSessionStore = mod.useSessionStore
})

describe('useSessionStore initial state', () => {
  it('should have empty initial state', () => {
    const state = useSessionStore.getState()
    expect(state.activeSession).toBeNull()
    expect(state.sessions).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.activeStartTime).toBeNull()
    expect(state.lastHeartbeat).toBeNull()
  })
})

describe('startSession', () => {
  it('should create session with correct fields', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    const state = useSessionStore.getState()
    expect(state.activeSession).toBeDefined()
    expect(state.activeSession!.courseId).toBe('course-1')
    expect(state.activeSession!.contentItemId).toBe('lesson-1')
    expect(state.activeSession!.sessionType).toBe('video')
    expect(state.activeSession!.duration).toBe(0)
    expect(state.activeSession!.idleTime).toBe(0)
    expect(state.activeSession!.videosWatched).toEqual([])
    expect(state.activeSession!.endTime).toBeUndefined()
    expect(state.activeStartTime).toBe(state.activeSession!.startTime)
    expect(state.error).toBeNull()
  })

  it('should persist session to IndexedDB', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    const { db } = await import('@/db')
    const sessions = await db.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].courseId).toBe('course-1')
  })

  it('should end existing session before starting new one', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10))

    await act(async () => {
      await useSessionStore.getState().startSession('course-2', 'lesson-2', 'pdf')
    })

    // Wait for fire-and-forget endSession persistence to complete
    // Use polling instead of fixed delay to avoid flakiness in CI
    const { db } = await import('@/db')
    let sessions = await db.studySessions.toArray()
    for (
      let attempt = 0;
      attempt < 20 && (!sessions[0]?.endTime || sessions.length < 2);
      attempt++
    ) {
      await new Promise(resolve => setTimeout(resolve, 50))
      sessions = await db.studySessions.toArray()
    }
    expect(sessions).toHaveLength(2)
    // First session should be ended
    expect(sessions[0].endTime).toBeDefined()
    // Second session should be active
    expect(sessions[1].endTime).toBeUndefined()
  })

  it('should rollback on persistence failure', async () => {
    // Mock db.studySessions.add to throw error on all retries
    const { db } = await import('@/db')
    vi.spyOn(db.studySessions, 'add').mockRejectedValue(new Error('DB error'))

    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    // Wait for persistWithRetry (3 retries with exponential backoff: 0ms, 1000ms, 2000ms delays)
    await new Promise(resolve => setTimeout(resolve, 4000))

    const state = useSessionStore.getState()
    expect(state.activeSession).toBeNull()
    expect(state.activeStartTime).toBeNull()
    expect(state.error).toBe('Failed to start session')
  })
})

describe('endSession', () => {
  it('should calculate duration correctly', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    // Wait 100ms
    await new Promise(resolve => setTimeout(resolve, 100))

    // Manually set lastActivity to 1500ms after activeStartTime (ensuring duration > 0 after Math.floor)
    act(() => {
      const state = useSessionStore.getState()
      const activeStartMs = new Date(state.activeStartTime!).getTime()
      const laterTime = new Date(activeStartMs + 1500).toISOString()

      useSessionStore.setState({
        activeSession: {
          ...state.activeSession!,
          lastActivity: laterTime,
        },
      })
    })

    act(() => {
      useSessionStore.getState().endSession()
    })

    // Wait for fire-and-forget persistence to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    const { db } = await import('@/db')
    const sessions = await db.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].endTime).toBeDefined()
    expect(sessions[0].duration).toBeGreaterThan(0)
  })

  it('should handle no active session gracefully', async () => {
    await act(async () => {
      await useSessionStore.getState().endSession()
    })

    const state = useSessionStore.getState()
    expect(state.error).toBeNull()
  })

  it('should clear active state', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    await act(async () => {
      await useSessionStore.getState().endSession()
    })

    const state = useSessionStore.getState()
    expect(state.activeSession).toBeNull()
    expect(state.activeStartTime).toBeNull()
    expect(state.lastHeartbeat).toBeNull()
  })

  it('should clear state even on persistence failure (fire-and-forget)', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    const { db } = await import('@/db')
    vi.spyOn(db.studySessions, 'put').mockRejectedValueOnce(new Error('DB error'))

    act(() => {
      useSessionStore.getState().endSession()
    })

    // State should be cleared immediately (synchronous), even though persistence will fail
    const state = useSessionStore.getState()
    expect(state.activeSession).toBeNull()
    expect(state.activeStartTime).toBeNull()
    expect(state.lastHeartbeat).toBeNull()
    expect(state.error).toBeNull() // No error set - fire-and-forget
  })
})

describe('pauseSession', () => {
  it('should accumulate active time correctly', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    // Simulate 100ms of activity
    await new Promise(resolve => setTimeout(resolve, 100))

    // Manually set lastActivity to 1500ms after activeStartTime (ensuring duration > 0 after Math.floor)
    act(() => {
      const state = useSessionStore.getState()
      const activeStartMs = new Date(state.activeStartTime!).getTime()
      const laterTime = new Date(activeStartMs + 1500).toISOString()

      useSessionStore.setState({
        activeSession: {
          ...state.activeSession!,
          lastActivity: laterTime,
        },
      })
    })

    await act(async () => {
      await useSessionStore.getState().pauseSession()
    })

    const state = useSessionStore.getState()
    expect(state.activeSession!.duration).toBeGreaterThan(0)
    expect(state.activeSession!.idleTime).toBe(300) // 5 minutes in seconds
  })

  it('should persist paused session', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    await act(async () => {
      await useSessionStore.getState().pauseSession()
    })

    const { db } = await import('@/db')
    const sessions = await db.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].idleTime).toBe(300)
  })

  it('should handle no active session gracefully', async () => {
    await act(async () => {
      await useSessionStore.getState().pauseSession()
    })

    const state = useSessionStore.getState()
    expect(state.error).toBeNull()
  })
})

describe('resumeSession', () => {
  it('should reset activeStartTime', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    const initialStartTime = useSessionStore.getState().activeStartTime

    await new Promise(resolve => setTimeout(resolve, 50))

    await act(async () => {
      await useSessionStore.getState().pauseSession()
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    await act(async () => {
      useSessionStore.getState().resumeSession()
    })

    const state = useSessionStore.getState()
    expect(state.activeStartTime).not.toBe(initialStartTime)
    expect(state.lastHeartbeat).toBeDefined()
  })

  it('should handle no active session gracefully', async () => {
    await act(async () => {
      useSessionStore.getState().resumeSession()
    })

    const state = useSessionStore.getState()
    expect(state.error).toBeNull()
  })
})

describe('updateLastActivity', () => {
  it('should throttle updates to 30 seconds', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    // Simulate 31 seconds have passed by setting lastHeartbeat to 31s ago
    const thirtyOneSecondsAgo = Date.now() - 31000
    useSessionStore.setState({ lastHeartbeat: thirtyOneSecondsAgo })

    const initialHeartbeat = useSessionStore.getState().lastHeartbeat

    // First update after 30s should update heartbeat
    act(() => {
      useSessionStore.getState().updateLastActivity()
    })

    const secondHeartbeat = useSessionStore.getState().lastHeartbeat
    expect(secondHeartbeat).not.toBe(initialHeartbeat)
    expect(secondHeartbeat).toBeGreaterThan(initialHeartbeat!)

    // Second update within 30s should not trigger state update (throttled)
    act(() => {
      useSessionStore.getState().updateLastActivity()
    })

    const thirdHeartbeat = useSessionStore.getState().lastHeartbeat
    expect(thirdHeartbeat).toBe(secondHeartbeat) // No change - throttled
  })
})

describe('recoverOrphanedSessions', () => {
  it('should close orphaned sessions', async () => {
    const { db } = await import('@/db')

    // Seed orphaned session (no endTime)
    const orphaned = makeSession({
      startTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      lastActivity: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      endTime: undefined,
      duration: 1800, // 30 min
    })

    await db.studySessions.add(orphaned)

    await act(async () => {
      await useSessionStore.getState().recoverOrphanedSessions()
    })

    const sessions = await db.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].endTime).toBe(orphaned.lastActivity)
    expect(sessions[0].duration).toBeGreaterThan(1800) // Should include time from start to lastActivity
  })

  it('should handle empty case', async () => {
    await act(async () => {
      await useSessionStore.getState().recoverOrphanedSessions()
    })

    const state = useSessionStore.getState()
    expect(state.error).toBeNull()
  })

  it('should use Math.max for duration calculation', async () => {
    const { db } = await import('@/db')

    // Session where accumulated duration is greater than start-to-lastActivity
    const orphaned = makeSession({
      startTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      lastActivity: new Date(Date.now() - 6000000).toISOString(), // 100 min ago
      endTime: undefined,
      duration: 5000, // 83 min accumulated (greater than 20 min gap)
    })

    await db.studySessions.add(orphaned)

    await act(async () => {
      await useSessionStore.getState().recoverOrphanedSessions()
    })

    const sessions = await db.studySessions.toArray()
    expect(sessions[0].duration).toBe(5000) // Should keep accumulated duration
  })
})

describe('getTotalStudyTime', () => {
  it('should sum completed sessions', async () => {
    const { db } = await import('@/db')

    await db.studySessions.bulkAdd([
      makeSession({ duration: 3600, endTime: new Date().toISOString() }),
      makeSession({ duration: 1800, endTime: new Date().toISOString() }),
      makeSession({ duration: 900, endTime: new Date().toISOString() }),
    ])

    await act(async () => {
      await useSessionStore.getState().loadSessionStats()
    })

    const total = useSessionStore.getState().getTotalStudyTime()
    expect(total).toBe(6300) // 1h 45m in seconds
  })

  it('should exclude incomplete sessions', async () => {
    const { db } = await import('@/db')

    await db.studySessions.bulkAdd([
      makeSession({ duration: 3600, endTime: new Date().toISOString() }),
      makeSession({ duration: 1800, endTime: undefined }), // Active session
    ])

    await act(async () => {
      await useSessionStore.getState().loadSessionStats()
    })

    const total = useSessionStore.getState().getTotalStudyTime()
    expect(total).toBe(3600) // Only completed session
  })

  it('should filter by courseId', async () => {
    const { db } = await import('@/db')

    await db.studySessions.bulkAdd([
      makeSession({ courseId: 'course-1', duration: 3600, endTime: new Date().toISOString() }),
      makeSession({ courseId: 'course-2', duration: 1800, endTime: new Date().toISOString() }),
      makeSession({ courseId: 'course-1', duration: 900, endTime: new Date().toISOString() }),
    ])

    await act(async () => {
      await useSessionStore.getState().loadSessionStats()
    })

    const course1Total = useSessionStore.getState().getTotalStudyTime('course-1')
    expect(course1Total).toBe(4500) // 1h 15m

    const course2Total = useSessionStore.getState().getTotalStudyTime('course-2')
    expect(course2Total).toBe(1800) // 30m
  })
})

describe('heartbeat', () => {
  it('should persist active session', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    // Manually modify activeSession (simulating activity updates)
    const state = useSessionStore.getState()
    state.activeSession!.lastActivity = new Date().toISOString()

    await act(async () => {
      await useSessionStore.getState().heartbeat()
    })

    const { db } = await import('@/db')
    const sessions = await db.studySessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(state.lastHeartbeat).toBeDefined()
  })

  it('should throttle to 30 seconds', async () => {
    await act(async () => {
      await useSessionStore.getState().startSession('course-1', 'lesson-1', 'video')
    })

    const initialHeartbeat = useSessionStore.getState().lastHeartbeat

    await act(async () => {
      await useSessionStore.getState().heartbeat()
    })

    const secondHeartbeat = useSessionStore.getState().lastHeartbeat
    expect(secondHeartbeat).toBe(initialHeartbeat) // Should be throttled (< 30s)
  })

  it('should handle no active session gracefully', async () => {
    await act(async () => {
      await useSessionStore.getState().heartbeat()
    })

    const state = useSessionStore.getState()
    expect(state.error).toBeNull()
  })
})

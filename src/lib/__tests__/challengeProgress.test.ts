import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'
import {
  calculateCompletionProgress,
  calculateTimeProgress,
  calculateStreakProgress,
  calculateProgress,
} from '@/lib/challengeProgress'
import type { Challenge, ContentProgress, StudySession } from '@/data/types'

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: crypto.randomUUID(),
    name: 'Test Challenge',
    type: 'completion',
    targetValue: 10,
    deadline: '2030-12-31',
    createdAt: '2026-03-01T00:00:00.000Z',
    currentProgress: 0,
    celebratedMilestones: [],
    ...overrides,
  }
}

function makeContentProgress(overrides: Partial<ContentProgress> = {}): ContentProgress {
  return {
    courseId: 'course-1',
    itemId: `lesson-${crypto.randomUUID().slice(0, 8)}`,
    status: 'completed',
    updatedAt: '2026-03-05T10:00:00.000Z',
    ...overrides,
  }
}

function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    contentItemId: 'lesson-1',
    startTime: '2026-03-05T09:00:00.000Z',
    endTime: '2026-03-05T11:00:00.000Z',
    duration: 7200,
    idleTime: 0,
    videosWatched: [],
    lastActivity: '2026-03-05T11:00:00.000Z',
    sessionType: 'video',
    ...overrides,
  }
}

beforeEach(async () => {
  await db.contentProgress.clear()
  await db.studySessions.clear()
  await db.challenges.clear()
  localStorage.clear()
})

// ── Completion Progress ──────────────────────────────

describe('calculateCompletionProgress', () => {
  it('counts completed items after challenge creation', async () => {
    const challenge = makeChallenge({ createdAt: '2026-03-01T00:00:00.000Z' })

    await db.contentProgress.bulkPut([
      makeContentProgress({ updatedAt: '2026-03-02T10:00:00.000Z' }),
      makeContentProgress({ updatedAt: '2026-03-03T10:00:00.000Z' }),
      makeContentProgress({ updatedAt: '2026-03-04T10:00:00.000Z' }),
    ])

    expect(await calculateCompletionProgress(challenge)).toBe(3)
  })

  it('excludes items completed before challenge creation', async () => {
    const challenge = makeChallenge({ createdAt: '2026-03-05T00:00:00.000Z' })

    await db.contentProgress.bulkPut([
      makeContentProgress({ updatedAt: '2026-03-01T10:00:00.000Z' }), // before
      makeContentProgress({ updatedAt: '2026-03-06T10:00:00.000Z' }), // after
    ])

    expect(await calculateCompletionProgress(challenge)).toBe(1)
  })

  it('excludes non-completed items', async () => {
    const challenge = makeChallenge()

    await db.contentProgress.bulkPut([
      makeContentProgress({ status: 'in-progress' }),
      makeContentProgress({ status: 'not-started' }),
      makeContentProgress({ status: 'completed' }),
    ])

    expect(await calculateCompletionProgress(challenge)).toBe(1)
  })

  it('returns 0 when no data exists', async () => {
    const challenge = makeChallenge()
    expect(await calculateCompletionProgress(challenge)).toBe(0)
  })
})

// ── Time Progress ────────────────────────────────────

describe('calculateTimeProgress', () => {
  it('sums session durations in hours after challenge creation', async () => {
    const challenge = makeChallenge({ createdAt: '2026-03-01T00:00:00.000Z' })

    await db.studySessions.bulkPut([
      makeSession({ startTime: '2026-03-02T09:00:00.000Z', duration: 3600 }), // 1h
      makeSession({ startTime: '2026-03-03T09:00:00.000Z', duration: 5400 }), // 1.5h
    ])

    expect(await calculateTimeProgress(challenge)).toBe(2.5)
  })

  it('excludes sessions before challenge creation', async () => {
    const challenge = makeChallenge({ createdAt: '2026-03-05T00:00:00.000Z' })

    await db.studySessions.bulkPut([
      makeSession({ startTime: '2026-03-01T09:00:00.000Z', duration: 7200 }), // before
      makeSession({ startTime: '2026-03-06T09:00:00.000Z', duration: 3600 }), // after
    ])

    expect(await calculateTimeProgress(challenge)).toBe(1)
  })

  it('excludes sessions without endTime (active/orphaned)', async () => {
    const challenge = makeChallenge()

    await db.studySessions.bulkPut([
      makeSession({ duration: 3600 }), // ended
      makeSession({ endTime: undefined, duration: 1800 }), // active
    ])

    expect(await calculateTimeProgress(challenge)).toBe(1)
  })

  it('returns 0 when no sessions exist', async () => {
    const challenge = makeChallenge()
    expect(await calculateTimeProgress(challenge)).toBe(0)
  })
})

// ── Streak Progress ──────────────────────────────────

describe('calculateStreakProgress', () => {
  it('returns 0 when no study log exists', () => {
    const challenge = makeChallenge({ type: 'streak', createdAt: '2026-03-01T00:00:00.000Z' })
    expect(calculateStreakProgress(challenge)).toBe(0)
  })

  it('counts distinct study days since challenge creation', () => {
    const challenge = makeChallenge({ type: 'streak', createdAt: '2026-03-03T00:00:00.000Z' })
    localStorage.setItem(
      'study-log',
      JSON.stringify([
        { type: 'lesson_complete', courseId: 'c1', timestamp: '2026-03-01T10:00:00.000Z' }, // before
        { type: 'lesson_complete', courseId: 'c1', timestamp: '2026-03-04T10:00:00.000Z' }, // after
        { type: 'lesson_complete', courseId: 'c1', timestamp: '2026-03-04T14:00:00.000Z' }, // same day
        { type: 'lesson_complete', courseId: 'c1', timestamp: '2026-03-05T10:00:00.000Z' }, // after
      ])
    )
    // 2 distinct days after creation (Mar 4 and Mar 5), Mar 1 excluded
    expect(calculateStreakProgress(challenge)).toBe(2)
  })

  it('excludes non-lesson_complete entries', () => {
    const challenge = makeChallenge({ type: 'streak', createdAt: '2026-03-01T00:00:00.000Z' })
    localStorage.setItem(
      'study-log',
      JSON.stringify([
        { type: 'lesson_complete', courseId: 'c1', timestamp: '2026-03-02T10:00:00.000Z' },
        { type: 'video_progress', courseId: 'c1', timestamp: '2026-03-03T10:00:00.000Z' },
      ])
    )
    expect(calculateStreakProgress(challenge)).toBe(1)
  })
})

// ── Progress Capping ────────────────────────────────

describe('progress capping at 100%', () => {
  it('completion progress can exceed targetValue (capping is in store)', async () => {
    const challenge = makeChallenge({ targetValue: 2 })

    await db.contentProgress.bulkPut([
      makeContentProgress(),
      makeContentProgress(),
      makeContentProgress(),
    ])

    // Raw count is 3, exceeds target of 2 — store is responsible for capping
    expect(await calculateCompletionProgress(challenge)).toBe(3)
  })

  it('time progress can exceed targetValue (capping is in store)', async () => {
    const challenge = makeChallenge({ type: 'time', targetValue: 1 })

    await db.studySessions.bulkPut([
      makeSession({ duration: 7200 }), // 2 hours, exceeds 1-hour target
    ])

    expect(await calculateTimeProgress(challenge)).toBe(2)
  })
})

// ── Dispatcher ───────────────────────────────────────

describe('calculateProgress', () => {
  it('routes completion type to completion calculator', async () => {
    const challenge = makeChallenge({ type: 'completion' })
    await db.contentProgress.bulkPut([makeContentProgress(), makeContentProgress()])

    expect(await calculateProgress(challenge)).toBe(2)
  })

  it('routes time type to time calculator', async () => {
    const challenge = makeChallenge({ type: 'time' })
    await db.studySessions.bulkPut([makeSession({ duration: 7200 })])

    expect(await calculateProgress(challenge)).toBe(2) // 7200s = 2h
  })

  it('routes streak type to streak calculator', async () => {
    const challenge = makeChallenge({ type: 'streak' })
    expect(await calculateProgress(challenge)).toBe(0)
  })
})

import { describe, it, expect } from 'vitest'
import {
  getRetentionLevel,
  getTopicRetention,
  getRetentionStats,
  detectEngagementDecay,
  formatTimeSinceReview,
} from '../retentionMetrics'
import type { Note, ReviewRecord, StudySession } from '@/data/types'

const FIXED_NOW = new Date('2025-01-15T12:00:00.000Z')
const MS_PER_DAY = 86_400_000

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: 'Test note',
    createdAt: FIXED_NOW.toISOString(),
    updatedAt: FIXED_NOW.toISOString(),
    tags: [],
    ...overrides,
  }
}

function makeReview(noteId: string, overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: crypto.randomUUID(),
    noteId,
    rating: 'good',
    reviewedAt: new Date(FIXED_NOW.getTime() - MS_PER_DAY).toISOString(),
    nextReviewAt: new Date(FIXED_NOW.getTime() + 2 * MS_PER_DAY).toISOString(),
    interval: 3,
    easeFactor: 2.5,
    reviewCount: 1,
    ...overrides,
  }
}

function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    contentItemId: 'lesson-1',
    startTime: FIXED_NOW.toISOString(),
    endTime: FIXED_NOW.toISOString(),
    duration: 1800,
    idleTime: 0,
    videosWatched: [],
    lastActivity: FIXED_NOW.toISOString(),
    sessionType: 'video',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────
// getRetentionLevel
// ─────────────────────────────────────────────────────────

describe('getRetentionLevel', () => {
  it('returns strong for retention ≥ 80%', () => {
    expect(getRetentionLevel(80)).toBe('strong')
    expect(getRetentionLevel(100)).toBe('strong')
  })

  it('returns fading for retention 50-79%', () => {
    expect(getRetentionLevel(50)).toBe('fading')
    expect(getRetentionLevel(79)).toBe('fading')
  })

  it('returns weak for retention < 50%', () => {
    expect(getRetentionLevel(49)).toBe('weak')
    expect(getRetentionLevel(0)).toBe('weak')
  })
})

// ─────────────────────────────────────────────────────────
// getTopicRetention
// ─────────────────────────────────────────────────────────

describe('getTopicRetention', () => {
  it('groups notes by primary tag and calculates average retention', () => {
    const note1 = makeNote({ tags: ['Math'] })
    const note2 = makeNote({ tags: ['Math'] })
    const review1 = makeReview(note1.id, {
      reviewedAt: FIXED_NOW.toISOString(), // just reviewed → high retention
      interval: 7,
    })
    const review2 = makeReview(note2.id, {
      reviewedAt: FIXED_NOW.toISOString(),
      interval: 7,
    })

    const result = getTopicRetention([note1, note2], [review1, review2], FIXED_NOW)
    expect(result).toHaveLength(1)
    expect(result[0].topic).toBe('Math')
    expect(result[0].retention).toBe(100)
    expect(result[0].level).toBe('strong')
    expect(result[0].noteCount).toBe(2)
  })

  it('returns empty array when no notes have reviews', () => {
    const note = makeNote({ tags: ['Physics'] })
    const result = getTopicRetention([note], [], FIXED_NOW)
    expect(result).toHaveLength(0)
  })

  it('excludes soft-deleted notes', () => {
    const note = makeNote({ tags: ['Chemistry'], deleted: true })
    const review = makeReview(note.id)
    const result = getTopicRetention([note], [review], FIXED_NOW)
    expect(result).toHaveLength(0)
  })

  it('uses "General" for notes without tags', () => {
    const note = makeNote({ tags: [] })
    const review = makeReview(note.id, { reviewedAt: FIXED_NOW.toISOString(), interval: 7 })
    const result = getTopicRetention([note], [review], FIXED_NOW)
    expect(result[0].topic).toBe('General')
  })

  it('sorts by retention ascending (weakest first)', () => {
    const noteStrong = makeNote({ tags: ['Strong Topic'] })
    const noteWeak = makeNote({ tags: ['Weak Topic'] })
    const reviewStrong = makeReview(noteStrong.id, {
      reviewedAt: FIXED_NOW.toISOString(),
      interval: 7,
    })
    const reviewWeak = makeReview(noteWeak.id, {
      reviewedAt: new Date(FIXED_NOW.getTime() - 14 * MS_PER_DAY).toISOString(),
      interval: 3,
    })

    const result = getTopicRetention([noteStrong, noteWeak], [reviewStrong, reviewWeak], FIXED_NOW)
    expect(result[0].topic).toBe('Weak Topic')
    expect(result[1].topic).toBe('Strong Topic')
  })

  it('calculates due count correctly', () => {
    const note1 = makeNote({ tags: ['History'] })
    const note2 = makeNote({ tags: ['History'] })
    const review1 = makeReview(note1.id, {
      nextReviewAt: new Date(FIXED_NOW.getTime() - MS_PER_DAY).toISOString(), // due
    })
    const review2 = makeReview(note2.id, {
      nextReviewAt: new Date(FIXED_NOW.getTime() + MS_PER_DAY).toISOString(), // not due
    })

    const result = getTopicRetention([note1, note2], [review1, review2], FIXED_NOW)
    expect(result[0].dueCount).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────
// getRetentionStats
// ─────────────────────────────────────────────────────────

describe('getRetentionStats', () => {
  it('returns zeros for empty reviews', () => {
    const stats = getRetentionStats([], FIXED_NOW)
    expect(stats).toEqual({ notesAtRisk: 0, dueToday: 0, avgRetention: 0 })
  })

  it('calculates at-risk count for reviews with low retention', () => {
    const note = makeNote()
    const review = makeReview(note.id, {
      reviewedAt: new Date(FIXED_NOW.getTime() - 14 * MS_PER_DAY).toISOString(),
      interval: 3,
    })
    const stats = getRetentionStats([review], FIXED_NOW)
    expect(stats.notesAtRisk).toBe(1)
  })

  it('counts due reviews', () => {
    const note = makeNote()
    const dueReview = makeReview(note.id, {
      nextReviewAt: new Date(FIXED_NOW.getTime() - MS_PER_DAY).toISOString(),
    })
    const futureReview = makeReview(makeNote().id, {
      nextReviewAt: new Date(FIXED_NOW.getTime() + 7 * MS_PER_DAY).toISOString(),
      reviewedAt: FIXED_NOW.toISOString(),
      interval: 7,
    })
    const stats = getRetentionStats([dueReview, futureReview], FIXED_NOW)
    expect(stats.dueToday).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────
// detectEngagementDecay
// ─────────────────────────────────────────────────────────

describe('detectEngagementDecay', () => {
  it('returns no alerts with no sessions', () => {
    expect(detectEngagementDecay([], FIXED_NOW)).toEqual([])
  })

  it('detects frequency decline when current 2-week count < 50% of previous', () => {
    const sessions: StudySession[] = []
    // Previous 2 weeks (14-28 days ago): 10 sessions
    for (let i = 0; i < 10; i++) {
      sessions.push(
        makeSession({
          startTime: new Date(FIXED_NOW.getTime() - (15 + i) * MS_PER_DAY).toISOString(),
          endTime: new Date(FIXED_NOW.getTime() - (15 + i) * MS_PER_DAY).toISOString(),
        })
      )
    }
    // Current 2 weeks (0-14 days ago): 2 sessions (<50% of 10)
    sessions.push(
      makeSession({
        startTime: new Date(FIXED_NOW.getTime() - 5 * MS_PER_DAY).toISOString(),
        endTime: new Date(FIXED_NOW.getTime() - 5 * MS_PER_DAY).toISOString(),
      })
    )
    sessions.push(
      makeSession({
        startTime: new Date(FIXED_NOW.getTime() - 1 * MS_PER_DAY).toISOString(),
        endTime: new Date(FIXED_NOW.getTime() - 1 * MS_PER_DAY).toISOString(),
      })
    )

    const alerts = detectEngagementDecay(sessions, FIXED_NOW)
    const frequencyAlert = alerts.find(a => a.type === 'frequency')
    expect(frequencyAlert).toBeDefined()
    expect(frequencyAlert!.message).toContain('frequency')
  })

  it('detects duration decline when latest week < 70% of 4-week average', () => {
    const sessions: StudySession[] = []
    // Weeks 2-4: long sessions (3600s)
    for (let week = 1; week <= 3; week++) {
      for (let i = 0; i < 3; i++) {
        sessions.push(
          makeSession({
            startTime: new Date(FIXED_NOW.getTime() - (week * 7 + i) * MS_PER_DAY).toISOString(),
            endTime: new Date(FIXED_NOW.getTime() - (week * 7 + i) * MS_PER_DAY).toISOString(),
            duration: 3600,
          })
        )
      }
    }
    // Latest week: short sessions (600s — well under 70% of 3600)
    for (let i = 0; i < 3; i++) {
      sessions.push(
        makeSession({
          startTime: new Date(FIXED_NOW.getTime() - (i + 1) * MS_PER_DAY).toISOString(),
          endTime: new Date(FIXED_NOW.getTime() - (i + 1) * MS_PER_DAY).toISOString(),
          duration: 600,
        })
      )
    }

    const alerts = detectEngagementDecay(sessions, FIXED_NOW)
    const durationAlert = alerts.find(a => a.type === 'duration')
    expect(durationAlert).toBeDefined()
    expect(durationAlert!.message).toContain('duration')
  })

  it('detects velocity stall when 3+ weeks have zero sessions', () => {
    // Only old sessions (4+ weeks ago), nothing in last 3 weeks
    const sessions = [
      makeSession({
        startTime: new Date(FIXED_NOW.getTime() - 35 * MS_PER_DAY).toISOString(),
        endTime: new Date(FIXED_NOW.getTime() - 35 * MS_PER_DAY).toISOString(),
      }),
    ]

    const alerts = detectEngagementDecay(sessions, FIXED_NOW)
    const velocityAlert = alerts.find(a => a.type === 'velocity')
    expect(velocityAlert).toBeDefined()
    expect(velocityAlert!.suggestion).toContain('revisit')
  })

  it('returns no alerts when engagement is healthy', () => {
    const sessions: StudySession[] = []
    // Consistent sessions every other day for 4 weeks
    for (let day = 0; day < 28; day += 2) {
      sessions.push(
        makeSession({
          startTime: new Date(FIXED_NOW.getTime() - day * MS_PER_DAY).toISOString(),
          endTime: new Date(FIXED_NOW.getTime() - day * MS_PER_DAY).toISOString(),
          duration: 1800,
        })
      )
    }

    const alerts = detectEngagementDecay(sessions, FIXED_NOW)
    expect(alerts).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────
// formatTimeSinceReview
// ─────────────────────────────────────────────────────────

describe('formatTimeSinceReview', () => {
  it('returns "Today" for same day', () => {
    expect(formatTimeSinceReview(FIXED_NOW.toISOString(), FIXED_NOW)).toBe('Today')
  })

  it('returns "1 day ago" for yesterday', () => {
    const yesterday = new Date(FIXED_NOW.getTime() - MS_PER_DAY).toISOString()
    expect(formatTimeSinceReview(yesterday, FIXED_NOW)).toBe('1 day ago')
  })

  it('returns "3 days ago" for 3 days', () => {
    const threeDays = new Date(FIXED_NOW.getTime() - 3 * MS_PER_DAY).toISOString()
    expect(formatTimeSinceReview(threeDays, FIXED_NOW)).toBe('3 days ago')
  })

  it('returns weeks for 7-13 days', () => {
    const tenDays = new Date(FIXED_NOW.getTime() - 10 * MS_PER_DAY).toISOString()
    expect(formatTimeSinceReview(tenDays, FIXED_NOW)).toBe('1 week ago')
  })

  it('returns months for 30+ days', () => {
    const sixtyDays = new Date(FIXED_NOW.getTime() - 60 * MS_PER_DAY).toISOString()
    expect(formatTimeSinceReview(sixtyDays, FIXED_NOW)).toBe('2 months ago')
  })
})

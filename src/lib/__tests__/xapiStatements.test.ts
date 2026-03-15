import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionToXAPI, progressToXAPI, challengeToXAPI } from '../xapiStatements'
import type { StudySession, ContentProgress, Challenge } from '@/data/types'

// Mock settings
vi.mock('../settings', () => ({
  getSettings: () => ({
    displayName: 'Test Student',
    bio: '',
    theme: 'system',
  }),
}))

describe('xapiStatements', () => {
  describe('sessionToXAPI', () => {
    it('generates "completed" verb for ended sessions', () => {
      const session: StudySession = {
        id: 's1',
        courseId: 'c1',
        contentItemId: 'l1',
        startTime: '2026-01-15T10:00:00Z',
        endTime: '2026-01-15T10:30:00Z',
        duration: 1800,
        idleTime: 120,
        videosWatched: ['v1'],
        lastActivity: '2026-01-15T10:29:00Z',
        sessionType: 'video',
        qualityScore: 85,
      }

      const stmt = sessionToXAPI(session)

      expect(stmt.verb.id).toBe('http://adlnet.gov/expapi/verbs/completed')
      expect(stmt.actor.name).toBe('Test Student')
      expect(stmt.object.id).toContain('c1')
      expect(stmt.object.id).toContain('l1')
      expect(stmt.result?.duration).toBe('PT30M')
      expect(stmt.result?.completion).toBe(true)
      expect(stmt.result?.score?.scaled).toBe(0.85)
      expect(stmt.timestamp).toBe('2026-01-15T10:00:00Z')
    })

    it('generates "experienced" verb for active sessions', () => {
      const session: StudySession = {
        id: 's2',
        courseId: 'c1',
        contentItemId: 'l2',
        startTime: '2026-01-15T14:00:00Z',
        duration: 300,
        idleTime: 0,
        videosWatched: [],
        lastActivity: '2026-01-15T14:05:00Z',
        sessionType: 'video',
      }

      const stmt = sessionToXAPI(session)

      expect(stmt.verb.id).toBe('http://adlnet.gov/expapi/verbs/experienced')
      expect(stmt.result?.completion).toBe(false)
    })
  })

  describe('progressToXAPI', () => {
    it('generates "completed" for completed items', () => {
      const progress: ContentProgress = {
        courseId: 'c1',
        itemId: 'mod1',
        status: 'completed',
        updatedAt: '2026-01-15T12:00:00Z',
      }

      const stmt = progressToXAPI(progress)

      expect(stmt.verb.id).toBe('http://adlnet.gov/expapi/verbs/completed')
      expect(stmt.result?.completion).toBe(true)
    })

    it('generates "progressed" for in-progress items', () => {
      const progress: ContentProgress = {
        courseId: 'c1',
        itemId: 'mod2',
        status: 'in-progress',
        updatedAt: '2026-01-15T13:00:00Z',
      }

      const stmt = progressToXAPI(progress)

      expect(stmt.verb.id).toBe('http://adlnet.gov/expapi/verbs/progressed')
      expect(stmt.result?.completion).toBe(false)
    })
  })

  describe('challengeToXAPI', () => {
    it('generates statement for completed challenges', () => {
      const challenge: Challenge = {
        id: 'ch1',
        name: 'Watch 10 videos',
        type: 'completion',
        targetValue: 10,
        deadline: '2026-02-01',
        createdAt: '2026-01-01T00:00:00Z',
        currentProgress: 10,
        celebratedMilestones: [25, 50, 75, 100],
        completedAt: '2026-01-20T15:00:00Z',
      }

      const stmt = challengeToXAPI(challenge)

      expect(stmt).not.toBeNull()
      expect(stmt!.verb.id).toBe('http://adlnet.gov/expapi/verbs/completed')
      expect(stmt!.object.definition.name['en-US']).toBe('Watch 10 videos')
      expect(stmt!.result?.score?.scaled).toBe(1.0)
    })

    it('returns null for incomplete challenges', () => {
      const challenge: Challenge = {
        id: 'ch2',
        name: 'Study 20 hours',
        type: 'time',
        targetValue: 20,
        deadline: '2026-03-01',
        createdAt: '2026-01-01T00:00:00Z',
        currentProgress: 5,
        celebratedMilestones: [25],
      }

      expect(challengeToXAPI(challenge)).toBeNull()
    })
  })
})

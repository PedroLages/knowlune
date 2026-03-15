import { describe, it, expect } from 'vitest'
import {
  sessionsToCSV,
  progressToCSV,
  deriveStreakDays,
  streakDaysToCSV,
} from '../csvSerializer'
import type { StudySession, ContentProgress } from '@/data/types'

describe('csvSerializer', () => {
  describe('sessionsToCSV', () => {
    it('generates CSV with headers and data rows', () => {
      const sessions: StudySession[] = [
        {
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
        },
      ]

      const csv = sessionsToCSV(sessions)
      const lines = csv.split('\n')

      expect(lines[0]).toBe(
        'ID,Course ID,Content Item ID,Start Time,End Time,Duration (seconds),Idle Time (seconds),Session Type,Quality Score'
      )
      expect(lines[1]).toBe('s1,c1,l1,2026-01-15T10:00:00Z,2026-01-15T10:30:00Z,1800,120,video,85')
    })

    it('handles empty sessions', () => {
      const csv = sessionsToCSV([])
      const lines = csv.split('\n')
      expect(lines).toHaveLength(1) // header only
    })

    it('escapes values with commas', () => {
      const sessions: StudySession[] = [
        {
          id: 'id,with,commas',
          courseId: 'c1',
          contentItemId: 'l1',
          startTime: '2026-01-15T10:00:00Z',
          duration: 60,
          idleTime: 0,
          videosWatched: [],
          lastActivity: '2026-01-15T10:00:00Z',
          sessionType: 'video',
        },
      ]

      const csv = sessionsToCSV(sessions)
      expect(csv).toContain('"id,with,commas"')
    })
  })

  describe('progressToCSV', () => {
    it('generates CSV for content progress', () => {
      const progress: ContentProgress[] = [
        { courseId: 'c1', itemId: 'mod1', status: 'completed', updatedAt: '2026-01-15T12:00:00Z' },
        { courseId: 'c1', itemId: 'mod2', status: 'in-progress', updatedAt: '2026-01-15T13:00:00Z' },
      ]

      const csv = progressToCSV(progress)
      const lines = csv.split('\n')

      expect(lines).toHaveLength(3) // header + 2 rows
      expect(lines[0]).toBe('Course ID,Item ID,Status,Updated At')
      expect(lines[1]).toContain('completed')
    })
  })

  describe('deriveStreakDays', () => {
    it('calculates consecutive study days', () => {
      const sessions: StudySession[] = [
        {
          id: 's1',
          courseId: 'c1',
          contentItemId: 'l1',
          startTime: '2026-01-15T10:00:00Z',
          duration: 1800,
          idleTime: 0,
          videosWatched: [],
          lastActivity: '2026-01-15T10:30:00Z',
          sessionType: 'video',
        },
        {
          id: 's2',
          courseId: 'c1',
          contentItemId: 'l2',
          startTime: '2026-01-16T14:00:00Z',
          duration: 900,
          idleTime: 0,
          videosWatched: [],
          lastActivity: '2026-01-16T14:15:00Z',
          sessionType: 'video',
        },
        {
          id: 's3',
          courseId: 'c1',
          contentItemId: 'l3',
          startTime: '2026-01-18T09:00:00Z', // gap: streak resets
          duration: 600,
          idleTime: 0,
          videosWatched: [],
          lastActivity: '2026-01-18T09:10:00Z',
          sessionType: 'video',
        },
      ]

      const streakDays = deriveStreakDays(sessions)

      expect(streakDays).toHaveLength(3)
      expect(streakDays[0].date).toBe('2026-01-15')
      expect(streakDays[0].streakDay).toBe(1)
      expect(streakDays[1].date).toBe('2026-01-16')
      expect(streakDays[1].streakDay).toBe(2)
      expect(streakDays[2].date).toBe('2026-01-18')
      expect(streakDays[2].streakDay).toBe(1) // reset after gap
    })

    it('aggregates multiple sessions per day', () => {
      const sessions: StudySession[] = [
        {
          id: 's1',
          courseId: 'c1',
          contentItemId: 'l1',
          startTime: '2026-01-15T10:00:00Z',
          duration: 1800,
          idleTime: 0,
          videosWatched: [],
          lastActivity: '2026-01-15T10:30:00Z',
          sessionType: 'video',
        },
        {
          id: 's2',
          courseId: 'c1',
          contentItemId: 'l2',
          startTime: '2026-01-15T14:00:00Z',
          duration: 900,
          idleTime: 0,
          videosWatched: [],
          lastActivity: '2026-01-15T14:15:00Z',
          sessionType: 'video',
        },
      ]

      const streakDays = deriveStreakDays(sessions)

      expect(streakDays).toHaveLength(1)
      expect(streakDays[0].sessionCount).toBe(2)
      expect(streakDays[0].totalMinutes).toBe(45) // (1800+900)/60
    })

    it('returns empty array for no sessions', () => {
      expect(deriveStreakDays([])).toEqual([])
    })
  })

  describe('streakDaysToCSV', () => {
    it('generates CSV with streak headers', () => {
      const csv = streakDaysToCSV([
        { date: '2026-01-15', sessionCount: 2, totalMinutes: 45, streakDay: 1 },
      ])

      const lines = csv.split('\n')
      expect(lines[0]).toBe('Date,Session Count,Total Minutes,Streak Day')
      expect(lines[1]).toBe('2026-01-15,2,45,1')
    })
  })
})

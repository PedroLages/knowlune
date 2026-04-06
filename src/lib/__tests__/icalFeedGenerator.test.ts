import { describe, it, expect } from 'vitest'
import {
  mapDaysToRRule,
  generateICalFeed,
  generateSRSSummaryEvents,
} from '../icalFeedGenerator'
import type { StudySchedule } from '../../data/types'

describe('icalFeedGenerator', () => {
  describe('mapDaysToRRule', () => {
    it('maps single day', () => {
      expect(mapDaysToRRule(['monday'])).toBe('MO')
    })

    it('maps multiple days', () => {
      expect(mapDaysToRRule(['monday', 'wednesday', 'friday'])).toBe('MO,WE,FR')
    })

    it('returns empty string for empty array', () => {
      expect(mapDaysToRRule([])).toBe('')
    })

    it('maps all days of the week', () => {
      const allDays = [
        'monday', 'tuesday', 'wednesday', 'thursday',
        'friday', 'saturday', 'sunday',
      ] as const
      const result = mapDaysToRRule([...allDays])
      expect(result).toBe('MO,TU,WE,TH,FR,SA,SU')
    })
  })

  describe('generateICalFeed', () => {
    const baseSchedule: StudySchedule = {
      id: 'sched-1',
      title: 'Morning Study',
      enabled: true,
      startTime: '09:00',
      durationMinutes: 60,
      recurrence: 'daily',
      days: [],
      reminderMinutes: 15,
      timezone: 'UTC',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }

    it('generates valid iCal output', () => {
      const result = generateICalFeed([baseSchedule], 'America/New_York')
      expect(result).toContain('BEGIN:VCALENDAR')
      expect(result).toContain('END:VCALENDAR')
      expect(result).toContain('Morning Study')
    })

    it('skips disabled schedules', () => {
      const disabled = { ...baseSchedule, enabled: false }
      const result = generateICalFeed([disabled], 'UTC')
      expect(result).toContain('BEGIN:VCALENDAR')
      expect(result).not.toContain('Morning Study')
    })

    it('includes VALARM when reminderMinutes > 0', () => {
      const result = generateICalFeed([baseSchedule], 'UTC')
      expect(result).toContain('BEGIN:VALARM')
      expect(result).toContain('Study reminder: Morning Study')
    })

    it('excludes VALARM when reminderMinutes is 0', () => {
      const noReminder = { ...baseSchedule, reminderMinutes: 0 }
      const result = generateICalFeed([noReminder], 'UTC')
      expect(result).not.toContain('BEGIN:VALARM')
    })

    it('generates weekly recurrence with BYDAY', () => {
      const weekly: StudySchedule = {
        ...baseSchedule,
        recurrence: 'weekly',
        days: ['monday', 'wednesday'],
      }
      const result = generateICalFeed([weekly], 'UTC')
      expect(result).toContain('FREQ=WEEKLY')
    })

    it('generates daily recurrence', () => {
      const result = generateICalFeed([baseSchedule], 'UTC')
      expect(result).toContain('FREQ=DAILY')
    })

    it('skips schedules with invalid startTime', () => {
      const invalid = { ...baseSchedule, startTime: 'invalid' }
      const result = generateICalFeed([invalid], 'UTC')
      expect(result).not.toContain('Morning Study')
    })

    it('handles multiple schedules', () => {
      const schedules = [
        baseSchedule,
        { ...baseSchedule, id: 'sched-2', title: 'Evening Review' },
      ]
      const result = generateICalFeed(schedules, 'UTC')
      expect(result).toContain('Morning Study')
      expect(result).toContain('Evening Review')
    })
  })

  describe('generateSRSSummaryEvents', () => {
    it('returns empty string for no reviews', () => {
      expect(generateSRSSummaryEvents([], '09:00', 'UTC')).toBe('')
    })

    it('generates events for due flashcards', () => {
      const counts = [{ date: '2026-04-01', count: 5 }]
      const result = generateSRSSummaryEvents(counts, '09:00', 'UTC')
      expect(result).toContain('BEGIN:VEVENT')
      expect(result).toContain('Review: 5 flashcards due')
    })

    it('uses singular "flashcard" for count of 1', () => {
      const counts = [{ date: '2026-04-01', count: 1 }]
      const result = generateSRSSummaryEvents(counts, '09:00', 'UTC')
      expect(result).toContain('Review: 1 flashcard due')
    })

    it('skips entries with count <= 0', () => {
      const counts = [
        { date: '2026-04-01', count: 0 },
        { date: '2026-04-02', count: -1 },
      ]
      const result = generateSRSSummaryEvents(counts, '09:00', 'UTC')
      expect(result).not.toContain('BEGIN:VEVENT')
    })

    it('skips entries with invalid dates', () => {
      const counts = [{ date: 'not-a-date', count: 3 }]
      const result = generateSRSSummaryEvents(counts, '09:00', 'UTC')
      expect(result).not.toContain('BEGIN:VEVENT')
    })

    it('uses default time when reviewTime is invalid', () => {
      const counts = [{ date: '2026-04-01', count: 2 }]
      const result = generateSRSSummaryEvents(counts, 'bad', 'UTC')
      expect(result).toContain('BEGIN:VEVENT')
    })

    it('generates UID with date', () => {
      const counts = [{ date: '2026-04-01', count: 3 }]
      const result = generateSRSSummaryEvents(counts, '09:00', 'UTC')
      expect(result).toContain('srs-2026-04-01@knowlune.app')
    })
  })
})

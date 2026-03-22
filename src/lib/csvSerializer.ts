/**
 * CSV serialization utilities for Knowlune data export.
 *
 * Generates RFC 4180-compliant CSV with proper escaping.
 * Three export formats: sessions, content progress, streaks (derived).
 */
import type { StudySession, ContentProgress } from '@/data/types'

/** Escape a value for CSV (RFC 4180) */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Convert array of objects to CSV string with headers */
function toCsv<T>(headers: Array<{ key: keyof T & string; label: string }>, rows: T[]): string {
  const headerLine = headers.map(h => escapeCsvValue(h.label)).join(',')
  const dataLines = rows.map(row => headers.map(h => escapeCsvValue(row[h.key])).join(','))
  return [headerLine, ...dataLines].join('\n')
}

// --- Sessions CSV ---

const SESSION_HEADERS: Array<{ key: keyof StudySession; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'courseId', label: 'Course ID' },
  { key: 'contentItemId', label: 'Content Item ID' },
  { key: 'startTime', label: 'Start Time' },
  { key: 'endTime', label: 'End Time' },
  { key: 'duration', label: 'Duration (seconds)' },
  { key: 'idleTime', label: 'Idle Time (seconds)' },
  { key: 'sessionType', label: 'Session Type' },
  { key: 'qualityScore', label: 'Quality Score' },
]

export function sessionsToCSV(sessions: StudySession[]): string {
  return toCsv(SESSION_HEADERS, sessions)
}

// --- Content Progress CSV ---

const PROGRESS_HEADERS: Array<{ key: keyof ContentProgress; label: string }> = [
  { key: 'courseId', label: 'Course ID' },
  { key: 'itemId', label: 'Item ID' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Updated At' },
]

export function progressToCSV(progress: ContentProgress[]): string {
  return toCsv(PROGRESS_HEADERS, progress)
}

// --- Streaks CSV (derived from sessions) ---

interface StreakDay {
  date: string
  sessionCount: number
  totalMinutes: number
  streakDay: number
}

export function deriveStreakDays(sessions: StudySession[]): StreakDay[] {
  // Group sessions by date (YYYY-MM-DD)
  const byDate = new Map<string, StudySession[]>()
  for (const session of sessions) {
    const date = session.startTime.split('T')[0]
    const existing = byDate.get(date) || []
    existing.push(session)
    byDate.set(date, existing)
  }

  // Sort dates chronologically
  const sortedDates = [...byDate.keys()].sort()

  // Calculate streak days
  const streakDays: StreakDay[] = []
  let currentStreak = 0
  let prevDate: Date | null = null

  for (const dateStr of sortedDates) {
    const sessions = byDate.get(dateStr)!
    const currentDate = new Date(dateStr + 'T00:00:00Z')

    // Check if consecutive day
    if (prevDate) {
      const diffMs = currentDate.getTime() - prevDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1
    } else {
      currentStreak = 1
    }

    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration, 0)

    streakDays.push({
      date: dateStr,
      sessionCount: sessions.length,
      totalMinutes: Math.round(totalSeconds / 60),
      streakDay: currentStreak,
    })

    prevDate = currentDate
  }

  return streakDays
}

const STREAK_HEADERS: Array<{ key: keyof StreakDay; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'sessionCount', label: 'Session Count' },
  { key: 'totalMinutes', label: 'Total Minutes' },
  { key: 'streakDay', label: 'Streak Day' },
]

export function streakDaysToCSV(streakDays: StreakDay[]): string {
  return toCsv(STREAK_HEADERS, streakDays)
}

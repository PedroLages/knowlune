import { toLocalDateString } from '@/lib/dateUtils'

const STORAGE_KEY = 'study-goals'

export interface StudyGoal {
  frequency: 'daily' | 'weekly'
  metric: 'time' | 'sessions'
  target: number // minutes (time) or count (sessions)
  createdAt: string // ISO timestamp
}

export interface GoalProgress {
  current: number // minutes or session count
  target: number
  percent: number // 0-100, clamped
  completed: boolean
}

export interface WeeklyAdherence {
  daysStudied: number
  totalDays: number // 7 (rolling week)
  percent: number // (daysStudied / totalDays) * 100
}

interface StudyLogEntry {
  type: string
  timestamp: string
  durationMs?: number
  [key: string]: unknown
}

// ── localStorage CRUD ──

export function getStudyGoal(): StudyGoal | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !('frequency' in parsed) ||
      !('metric' in parsed) ||
      !('target' in parsed) ||
      ((parsed as Record<string, unknown>).frequency !== 'daily' &&
        (parsed as Record<string, unknown>).frequency !== 'weekly') ||
      ((parsed as Record<string, unknown>).metric !== 'time' &&
        (parsed as Record<string, unknown>).metric !== 'sessions') ||
      typeof (parsed as Record<string, unknown>).target !== 'number' ||
      ((parsed as Record<string, unknown>).target as number) <= 0
    ) {
      return null
    }
    return parsed as StudyGoal
  } catch {
    return null
  }
}

export function saveStudyGoal(goal: StudyGoal): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goal))
  window.dispatchEvent(new CustomEvent('study-goals-updated'))
}

export function clearStudyGoal(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('study-goals-updated'))
}

// ── Progress computation ──

function isToday(dateStr: string): boolean {
  return toLocalDateString(new Date(dateStr)) === toLocalDateString(new Date())
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? 6 : day - 1 // Monday-based week
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isInCurrentWeek(dateStr: string): boolean {
  const date = new Date(dateStr)
  const weekStart = getStartOfWeek(new Date())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return date >= weekStart && date < weekEnd
}

function completedEntries(log: StudyLogEntry[]): StudyLogEntry[] {
  return log.filter(e => e.type === 'lesson_complete')
}

function buildProgress(current: number, target: number): GoalProgress {
  if (target <= 0) {
    return { current, target, percent: 0, completed: false }
  }
  const percent = Math.min(100, Math.round((current / target) * 100))
  return { current, target, percent, completed: current >= target }
}

function sumMinutes(entries: StudyLogEntry[]): number {
  return Math.round(entries.reduce((sum, e) => sum + (e.durationMs ? e.durationMs / 60000 : 0), 0))
}

export function computeDailyProgress(goal: StudyGoal, studyLog: StudyLogEntry[]): GoalProgress {
  const todayEntries = completedEntries(studyLog).filter(e => isToday(e.timestamp))

  if (goal.metric === 'time') {
    return buildProgress(sumMinutes(todayEntries), goal.target)
  }
  // sessions metric
  return buildProgress(todayEntries.length, goal.target)
}

export function computeWeeklyProgress(goal: StudyGoal, studyLog: StudyLogEntry[]): GoalProgress {
  const weekEntries = completedEntries(studyLog).filter(e => isInCurrentWeek(e.timestamp))

  if (goal.metric === 'time') {
    return buildProgress(sumMinutes(weekEntries), goal.target)
  }
  return buildProgress(weekEntries.length, goal.target)
}

export function computeGoalProgress(goal: StudyGoal, studyLog: StudyLogEntry[]): GoalProgress {
  return goal.frequency === 'daily'
    ? computeDailyProgress(goal, studyLog)
    : computeWeeklyProgress(goal, studyLog)
}

export function computeWeeklyAdherence(studyLog: StudyLogEntry[]): WeeklyAdherence {
  const now = new Date()
  const validDates = new Set<string>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    validDates.add(toLocalDateString(d))
  }

  const daysWithStudy = new Set<string>()
  for (const entry of completedEntries(studyLog)) {
    const entryDateStr = toLocalDateString(new Date(entry.timestamp))
    if (validDates.has(entryDateStr)) {
      daysWithStudy.add(entryDateStr)
    }
  }

  const daysStudied = daysWithStudy.size
  const totalDays = 7
  const percent = Math.round((daysStudied / totalDays) * 100)

  return { daysStudied, totalDays, percent }
}

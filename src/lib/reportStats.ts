import { allCourses } from '@/data/courses'
import {
  getAllProgress,
  getCourseCompletionPercent,
  getTotalCompletedLessons,
  getCoursesInProgress,
  getCompletedCourses,
  getLast7DaysLessonCompletions,
  getWeeklyChange,
} from '@/lib/progress'
import { getActionsPerDay, getCurrentStreak } from '@/lib/studyLog'
import { db } from '@/db/schema'
import type { StudySession } from '@/data/types'

/* ------------------------------------------------------------------ */
/*  Stat card trends (reuse with StatsCard component)                  */
/* ------------------------------------------------------------------ */

export interface ReportStat {
  label: string
  value: string | number
  icon: string // lucide icon name — resolved in the component
  trend?: 'up' | 'down'
  trendValue?: string
  sparkline?: number[]
}

export function computeStatTrends() {
  const lessonsChange = getWeeklyChange('lessons')
  const notesChange = getWeeklyChange('notes')
  const sparkline = getLast7DaysLessonCompletions()

  return { lessonsChange, notesChange, sparkline }
}

/* ------------------------------------------------------------------ */
/*  Category completion data for Radar chart                           */
/* ------------------------------------------------------------------ */

export interface CategoryRadarData {
  category: string
  completion: number // 0-100 average completion %
  fullMark: 100
}

/** Format category slugs to Title Case (e.g. "behavioral-analysis" → "Behavioral Analysis") */
function formatCategoryLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function getCategoryCompletionForRadar(): CategoryRadarData[] {
  const categoryMap: Record<string, { totalCompletion: number; count: number }> = {}

  for (const course of allCourses) {
    const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    const completion = getCourseCompletionPercent(course.id, totalLessons)
    const cat = course.category

    if (!categoryMap[cat]) {
      categoryMap[cat] = { totalCompletion: 0, count: 0 }
    }
    categoryMap[cat].totalCompletion += completion
    categoryMap[cat].count++
  }

  return Object.entries(categoryMap).map(([category, data]) => ({
    category: formatCategoryLabel(category),
    completion: Math.round(data.totalCompletion / data.count),
    fullMark: 100,
  }))
}

/* ------------------------------------------------------------------ */
/*  Course completion data for horizontal bar chart                    */
/* ------------------------------------------------------------------ */

export interface CourseCompletionData {
  name: string
  completion: number
  category: string
}

export function getCourseCompletionData(): CourseCompletionData[] {
  return allCourses
    .map(c => ({
      name: c.title,
      completion: getCourseCompletionPercent(
        c.id,
        c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
      ),
      category: c.category,
    }))
    .sort((a, b) => b.completion - a.completion)
}

/** Map category names to chart color tokens */
export function getCategoryColorMap(): Record<string, string> {
  const categories = [...new Set(allCourses.map(c => c.category))]
  const colors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ]
  const map: Record<string, string> = {}
  categories.forEach((cat, i) => {
    map[cat] = colors[i % colors.length]
  })
  return map
}

/* ------------------------------------------------------------------ */
/*  Skills radar dimensions (5 axes)                                   */
/* ------------------------------------------------------------------ */

export interface SkillDimension {
  dimension: string
  value: number // 0-100
  fullMark: 100
}

export function computeSkillsDimensions(): SkillDimension[] {
  const allProgress = getAllProgress()
  const totalLessons = allCourses.reduce(
    (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0),
    0
  )
  const completedLessons = getTotalCompletedLessons(allProgress)

  // 1. Completion: % of all lessons completed
  const completionScore = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // 2. Consistency: streak days / 7 (capped at 100)
  const streak = getCurrentStreak()
  const consistencyScore = Math.min(100, Math.round((streak / 7) * 100))

  // 3. Breadth: % of categories with at least one started course
  const allCategories = new Set(allCourses.map(c => c.category))
  const startedCategories = new Set(
    Object.keys(allProgress)
      .map(courseId => allCourses.find(c => c.id === courseId)?.category)
      .filter(Boolean)
  )
  const breadthScore =
    allCategories.size > 0 ? Math.round((startedCategories.size / allCategories.size) * 100) : 0

  // 4. Depth: average completion of started courses
  const inProgress = getCoursesInProgress(allCourses, allProgress)
  const completed = getCompletedCourses(allCourses, allProgress)
  const startedCourses = [
    ...inProgress,
    ...completed.map(c => {
      const total = c.modules.reduce((s, m) => s + m.lessons.length, 0)
      return { ...c, completionPercent: total > 0 ? 100 : 0 }
    }),
  ]
  const depthScore =
    startedCourses.length > 0
      ? Math.round(
          startedCourses.reduce((sum, c) => sum + c.completionPercent, 0) / startedCourses.length
        )
      : 0

  // 5. Engagement: actions per day over last 7 days (normalized to 100)
  const recentActivity = getActionsPerDay(7)
  const avgActions =
    recentActivity.length > 0
      ? recentActivity.reduce((sum, d) => sum + d.count, 0) / recentActivity.length
      : 0
  // 5 actions/day = 100% engagement (adjustable threshold)
  const engagementScore = Math.min(100, Math.round((avgActions / 5) * 100))

  return [
    { dimension: 'Completion', value: completionScore, fullMark: 100 },
    { dimension: 'Consistency', value: consistencyScore, fullMark: 100 },
    { dimension: 'Breadth', value: breadthScore, fullMark: 100 },
    { dimension: 'Depth', value: depthScore, fullMark: 100 },
    { dimension: 'Engagement', value: engagementScore, fullMark: 100 },
  ]
}

/* ------------------------------------------------------------------ */
/*  Weekly study goal progress (for radial ring)                       */
/* ------------------------------------------------------------------ */

export interface WeeklyGoalProgress {
  currentMinutes: number
  goalMinutes: number
  percentage: number // 0-100, can exceed 100
}

const DEFAULT_WEEKLY_GOAL_MINUTES = 5 * 60 // 5 hours

export async function computeWeeklyGoalProgress(): Promise<WeeklyGoalProgress> {
  const goalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES

  try {
    // Get sessions from this week (Monday to now)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const monday = new Date(now)
    monday.setDate(monday.getDate() - mondayOffset)
    monday.setHours(0, 0, 0, 0)

    const sessions: StudySession[] = await db.studySessions
      .where('startTime')
      .aboveOrEqual(monday.toISOString())
      .toArray()

    const currentMinutes = sessions.reduce((sum, s) => sum + Math.round((s.duration ?? 0) / 60), 0)
    const percentage = goalMinutes > 0 ? Math.round((currentMinutes / goalMinutes) * 100) : 0

    return { currentMinutes, goalMinutes, percentage }
  } catch {
    return { currentMinutes: 0, goalMinutes: goalMinutes, percentage: 0 }
  }
}

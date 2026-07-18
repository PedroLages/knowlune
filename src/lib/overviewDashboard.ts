import type {
  ContentProgress,
  Flashcard,
  ImportedCourse,
  ImportedPdf,
  ImportedVideo,
  StudySchedule,
  StudySession,
  VideoProgress,
} from '@/data/types'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { getActivityLevel, type HeatmapLevel } from '@/lib/activityHeatmap'
import { toLocalDateString } from '@/lib/dateUtils'

const DAY_MS = 24 * 60 * 60 * 1000
const COMPLETION_THRESHOLD = 90

export type OverviewLearnerState = 'new' | 'early' | 'active' | 'returning'

export interface OverviewDashboardSnapshot {
  courses: ImportedCourse[]
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
  contentProgress: ContentProgress[]
  videoProgress: VideoProgress[]
  sessions: StudySession[]
  schedules: StudySchedule[]
  flashcards: Flashcard[]
  quizzes: Quiz[]
  quizAttempts: QuizAttempt[]
}

export interface DashboardLessonOption {
  id: string
  title: string
  type: 'video' | 'pdf'
}

export interface LearningFocus {
  courseId: string
  courseName: string
  courseStatus: ImportedCourse['status']
  category: string
  completionPercent: number
  completedItems: number
  totalItems: number
  variant: 'start' | 'continue' | 'review'
  lessonId: string | null
  lessonTitle: string | null
  lessonOptions: DashboardLessonOption[]
  lastActivityAt: string
}

export interface DashboardSchedule {
  id: string
  title: string
  startsAt: string
  durationMinutes: number
  courseId?: string
}

export interface TodayOverview {
  dueReviews: number
  nextSchedule: DashboardSchedule | null
  focusArea: { name: string; score: number; action: string } | null
}

export interface ComparisonMetric {
  value: number
  previousValue: number
  deltaPercent: number | null
}

export interface DashboardMetrics {
  studyMinutes: ComparisonMetric
  activeDays: ComparisonMetric
  currentStreak: number
  reviewsDue: number
}

export interface StudyTrendPoint {
  date: string
  label: string
  minutes: number
}

export interface ActiveCourseProgress {
  courseId: string
  name: string
  category: string
  completionPercent: number
  completedItems: number
  totalItems: number
  lastActivityAt: string
}

export interface DashboardHeatmapDay {
  date: string
  minutes: number
  level: HeatmapLevel
  isToday: boolean
}

export interface DashboardActivity {
  id: string
  type: 'study' | 'quiz'
  title: string
  detail: string
  occurredAt: string
  courseId?: string
}

export interface MasteryInsight {
  name: string
  score: number
  retention: number | null
  urgency: number
}

export interface AssessmentInsight {
  averageScore: number
  attempts: Array<{ id: string; label: string; percentage: number; completedAt: string }>
  weakTopics: Array<{ name: string; accuracy: number; answers: number }>
}

export interface ReadingInsight {
  minutesLast30Days: number
  pagesReached: number
  documentsWithProgress: number
  recentItem: { title: string; courseName: string; currentPage: number; totalPages: number } | null
}

export interface LearningInsights {
  mastery: MasteryInsight[]
  assessment: AssessmentInsight | null
  reading: ReadingInsight | null
}

export interface LibraryCourse {
  course: ImportedCourse
  completionPercent: number
}

export interface ReadyOverviewDashboardModel {
  status: 'ready'
  learnerState: OverviewLearnerState
  learningFocus: LearningFocus | null
  today: TodayOverview
  metrics: DashboardMetrics
  studyTrend: { sevenDays: StudyTrendPoint[]; thirtyDays: StudyTrendPoint[] }
  activeCourses: ActiveCourseProgress[]
  heatmap: DashboardHeatmapDay[]
  recentActivity: DashboardActivity[]
  insights: LearningInsights
  library: LibraryCourse[]
  allTags: string[]
}

function startOfLocalDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function validTimestamp(value?: string): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function cleanContentTitle(filename: string): string {
  return filename
    .replace(/\.(pdf|mp4|mkv|avi|webm|ts)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatActivityMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(Math.max(0, seconds) / 60))
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

function comparePeriod(current: number, previous: number): ComparisonMetric {
  return {
    value: current,
    previousValue: previous,
    deltaPercent:
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? null : 0,
  }
}

function completedSessions(sessions: StudySession[]): StudySession[] {
  return sessions.filter(
    session => Boolean(session.endTime) && Number.isFinite(session.duration) && session.duration > 0
  )
}

function getLearnerState(
  courses: ImportedCourse[],
  sessions: StudySession[],
  now: Date
): OverviewLearnerState {
  if (courses.length === 0) return 'new'
  if (sessions.length === 0) return 'early'

  const latest = sessions.reduce(
    (latestTimestamp, session) => Math.max(latestTimestamp, validTimestamp(session.endTime)),
    0
  )
  const calendarDaysSinceActivity = Math.floor(
    (startOfLocalDay(now).getTime() - startOfLocalDay(new Date(latest)).getTime()) / DAY_MS
  )
  if (calendarDaysSinceActivity > 14) return 'returning'
  return sessions.length < 3 ? 'early' : 'active'
}

function buildContentByCourse(
  snapshot: OverviewDashboardSnapshot
): Map<string, DashboardLessonOption[]> {
  const result = new Map<string, DashboardLessonOption[]>()
  const orderedVideos = [...snapshot.videos].sort((a, b) => a.order - b.order)

  for (const video of orderedVideos) {
    const items = result.get(video.courseId) ?? []
    items.push({
      id: video.id,
      title: video.title?.trim() || cleanContentTitle(video.filename),
      type: 'video',
    })
    result.set(video.courseId, items)
  }
  for (const pdf of snapshot.pdfs) {
    const items = result.get(pdf.courseId) ?? []
    items.push({ id: pdf.id, title: cleanContentTitle(pdf.filename), type: 'pdf' })
    result.set(pdf.courseId, items)
  }
  return result
}

function buildCourseProgress(snapshot: OverviewDashboardSnapshot): ActiveCourseProgress[] {
  const contentByCourse = buildContentByCourse(snapshot)
  const completedByCourse = new Map<string, Set<string>>()
  const activityByCourse = new Map<string, number>()

  for (const progress of snapshot.videoProgress) {
    if (progress.completionPercentage >= COMPLETION_THRESHOLD) {
      const completed = completedByCourse.get(progress.courseId) ?? new Set<string>()
      completed.add(progress.videoId)
      completedByCourse.set(progress.courseId, completed)
    }
    const timestamp = Math.max(
      validTimestamp(progress.updatedAt),
      validTimestamp(progress.completedAt)
    )
    activityByCourse.set(
      progress.courseId,
      Math.max(activityByCourse.get(progress.courseId) ?? 0, timestamp)
    )
  }

  for (const progress of snapshot.contentProgress) {
    if (progress.status === 'completed') {
      const completed = completedByCourse.get(progress.courseId) ?? new Set<string>()
      completed.add(progress.itemId)
      completedByCourse.set(progress.courseId, completed)
    }
    activityByCourse.set(
      progress.courseId,
      Math.max(activityByCourse.get(progress.courseId) ?? 0, validTimestamp(progress.updatedAt))
    )
  }

  for (const session of snapshot.sessions) {
    activityByCourse.set(
      session.courseId,
      Math.max(
        activityByCourse.get(session.courseId) ?? 0,
        validTimestamp(session.endTime ?? session.lastActivity ?? session.startTime)
      )
    )
  }

  return snapshot.courses.map(course => {
    const totalItems = contentByCourse.get(course.id)?.length ?? 0
    const completedItems = Math.min(completedByCourse.get(course.id)?.size ?? 0, totalItems)
    const completionPercent =
      course.status === 'completed'
        ? 100
        : totalItems > 0
          ? Math.round((completedItems / totalItems) * 100)
          : 0
    const lastActivityTimestamp = Math.max(
      activityByCourse.get(course.id) ?? 0,
      validTimestamp(course.importedAt)
    )
    return {
      courseId: course.id,
      name: course.name,
      category: course.category,
      completionPercent,
      completedItems,
      totalItems,
      lastActivityAt: new Date(lastActivityTimestamp).toISOString(),
    }
  })
}

function buildLearningFocus(
  snapshot: OverviewDashboardSnapshot,
  courseProgress: ActiveCourseProgress[]
): LearningFocus | null {
  if (snapshot.courses.length === 0) return null
  const courseById = new Map(snapshot.courses.map(course => [course.id, course]))
  const contentByCourse = buildContentByCourse(snapshot)
  const progressByCourse = new Map(courseProgress.map(progress => [progress.courseId, progress]))

  const sorted = [...courseProgress].sort((a, b) => {
    const courseA = courseById.get(a.courseId)
    const courseB = courseById.get(b.courseId)
    const priority = (course: ImportedCourse | undefined, progress: ActiveCourseProgress) => {
      if (course?.status === 'active' && progress.completionPercent < 100) return 0
      if (progress.completionPercent > 0 && progress.completionPercent < 100) return 1
      if (course?.status === 'not-started') return 2
      if (course?.status === 'paused') return 3
      return 4
    }
    const priorityDifference = priority(courseA, a) - priority(courseB, b)
    return priorityDifference || validTimestamp(b.lastActivityAt) - validTimestamp(a.lastActivityAt)
  })

  const selectedProgress = sorted[0]
  const selectedCourse = courseById.get(selectedProgress.courseId)
  if (!selectedCourse) return null

  const lessonOptions = contentByCourse.get(selectedCourse.id) ?? []
  const availableIds = new Set(lessonOptions.map(item => item.id))
  const recentProgress = snapshot.videoProgress
    .filter(
      progress => progress.courseId === selectedCourse.id && availableIds.has(progress.videoId)
    )
    .sort((a, b) => {
      const timestampDifference =
        Math.max(validTimestamp(b.updatedAt), validTimestamp(b.completedAt)) -
        Math.max(validTimestamp(a.updatedAt), validTimestamp(a.completedAt))
      if (timestampDifference !== 0) return timestampDifference
      if (a.currentTime > 0 && b.currentTime <= 0) return -1
      if (b.currentTime > 0 && a.currentTime <= 0) return 1
      return b.completionPercentage - a.completionPercentage
    })[0]
  const selectedLesson =
    lessonOptions.find(item => item.id === recentProgress?.videoId) ?? lessonOptions[0] ?? null
  const variant =
    selectedProgress.completionPercent >= 100
      ? 'review'
      : selectedProgress.completionPercent > 0 || selectedCourse.status !== 'not-started'
        ? 'continue'
        : 'start'

  return {
    courseId: selectedCourse.id,
    courseName: selectedCourse.name,
    courseStatus: selectedCourse.status,
    category: selectedCourse.category,
    completionPercent: selectedProgress.completionPercent,
    completedItems: selectedProgress.completedItems,
    totalItems: selectedProgress.totalItems,
    variant,
    lessonId: selectedLesson?.id ?? null,
    lessonTitle: selectedLesson?.title ?? null,
    lessonOptions,
    lastActivityAt:
      progressByCourse.get(selectedCourse.id)?.lastActivityAt ?? selectedCourse.importedAt,
  }
}

const DAY_NAMES: Array<StudySchedule['days'][number]> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

function getNextSchedule(schedules: StudySchedule[], now: Date): DashboardSchedule | null {
  const candidates: DashboardSchedule[] = []
  for (const schedule of schedules.filter(item => item.enabled)) {
    const [hoursValue, minutesValue] = schedule.startTime.split(':').map(Number)
    if (!Number.isFinite(hoursValue) || !Number.isFinite(minutesValue)) continue
    for (let offset = 0; offset <= 7; offset++) {
      const startsAt = addLocalDays(startOfLocalDay(now), offset)
      if (!schedule.days.includes(DAY_NAMES[startsAt.getDay()])) continue
      startsAt.setHours(hoursValue, minutesValue, 0, 0)
      if (startsAt.getTime() < now.getTime()) continue
      candidates.push({
        id: schedule.id,
        title: schedule.title,
        startsAt: startsAt.toISOString(),
        durationMinutes: schedule.durationMinutes,
        courseId: schedule.courseId,
      })
      break
    }
  }
  return (
    candidates.sort((a, b) => validTimestamp(a.startsAt) - validTimestamp(b.startsAt))[0] ?? null
  )
}

function buildToday(
  snapshot: OverviewDashboardSnapshot,
  knowledgeTopics: ScoredTopic[],
  now: Date
): TodayOverview {
  const dueReviews = snapshot.flashcards.filter(card => {
    const due = validTimestamp(card.due)
    return due > 0 && due <= now.getTime()
  }).length
  const focus = [...knowledgeTopics].sort((a, b) => b.urgency - a.urgency)[0]
  return {
    dueReviews,
    nextSchedule: getNextSchedule(snapshot.schedules, now),
    focusArea: focus
      ? {
          name: focus.name,
          score: focus.scoreResult.score,
          action: focus.suggestedActions[0] ?? 'Review this topic',
        }
      : null,
  }
}

function sessionsInRange(sessions: StudySession[], start: Date, end: Date): StudySession[] {
  return sessions.filter(session => {
    const timestamp = validTimestamp(session.startTime)
    return timestamp >= start.getTime() && timestamp < end.getTime()
  })
}

function buildMetrics(sessions: StudySession[], dueReviews: number, now: Date): DashboardMetrics {
  const todayStart = startOfLocalDay(now)
  const currentStart = addLocalDays(todayStart, -7)
  const previousStart = addLocalDays(todayStart, -14)
  const current = sessionsInRange(sessions, currentStart, todayStart)
  const previous = sessionsInRange(sessions, previousStart, currentStart)
  const sumMinutes = (items: StudySession[]) =>
    Math.round(items.reduce((total, session) => total + session.duration, 0) / 60)
  const activeDayCount = (items: StudySession[]) =>
    new Set(items.map(session => toLocalDateString(new Date(session.startTime)))).size

  const activeDates = new Set(
    sessions.map(session => toLocalDateString(new Date(session.startTime)))
  )
  let streakAnchor = todayStart
  if (!activeDates.has(toLocalDateString(streakAnchor))) {
    streakAnchor = addLocalDays(streakAnchor, -1)
  }
  let currentStreak = 0
  while (activeDates.has(toLocalDateString(streakAnchor))) {
    currentStreak++
    streakAnchor = addLocalDays(streakAnchor, -1)
  }

  return {
    studyMinutes: comparePeriod(sumMinutes(current), sumMinutes(previous)),
    activeDays: comparePeriod(activeDayCount(current), activeDayCount(previous)),
    currentStreak,
    reviewsDue: dueReviews,
  }
}

function buildStudyTrend(sessions: StudySession[], days: number, now: Date): StudyTrendPoint[] {
  const dayTotals = new Map<string, number>()
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = addLocalDays(startOfLocalDay(now), -offset)
    dayTotals.set(toLocalDateString(date), 0)
  }
  for (const session of sessions) {
    const date = toLocalDateString(new Date(session.startTime))
    if (dayTotals.has(date)) {
      dayTotals.set(date, (dayTotals.get(date) ?? 0) + session.duration)
    }
  }
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return [...dayTotals].map(([date, seconds]) => ({
    date,
    label: formatter.format(new Date(`${date}T12:00:00`)),
    minutes: Math.round(seconds / 60),
  }))
}

function buildHeatmap(sessions: StudySession[], now: Date): DashboardHeatmapDay[] {
  const trend = buildStudyTrend(sessions, 84, now)
  const today = toLocalDateString(now)
  return trend.map(day => ({
    date: day.date,
    minutes: day.minutes,
    level: getActivityLevel(day.minutes * 60),
    isToday: day.date === today,
  }))
}

function buildRecentActivity(snapshot: OverviewDashboardSnapshot): DashboardActivity[] {
  const courseById = new Map(snapshot.courses.map(course => [course.id, course]))
  const quizById = new Map(snapshot.quizzes.map(quiz => [quiz.id, quiz]))
  const contentCourse = new Map<string, string>()
  for (const video of snapshot.videos) contentCourse.set(video.id, video.courseId)
  for (const pdf of snapshot.pdfs) contentCourse.set(pdf.id, pdf.courseId)
  for (const progress of snapshot.contentProgress)
    contentCourse.set(progress.itemId, progress.courseId)

  const activities: DashboardActivity[] = snapshot.sessions
    .filter(session => Boolean(session.endTime) && session.duration > 0)
    .map(session => ({
      id: `session-${session.id}`,
      type: 'study' as const,
      title: courseById.get(session.courseId)?.name ?? 'Study session',
      detail: `${session.sessionType === 'pdf' ? 'Reading' : session.sessionType === 'mixed' ? 'Mixed study' : 'Video study'} · ${formatActivityMinutes(session.duration)}`,
      occurredAt: session.endTime!,
      courseId: session.courseId,
    }))

  for (const attempt of snapshot.quizAttempts) {
    const quiz = quizById.get(attempt.quizId)
    const courseId = quiz ? contentCourse.get(quiz.lessonId) : undefined
    activities.push({
      id: `quiz-${attempt.id}`,
      type: 'quiz',
      title: quiz?.title ?? 'Quiz completed',
      detail: `${Math.round(attempt.percentage)}% · ${attempt.passed ? 'Passed' : 'Keep practicing'}`,
      occurredAt: attempt.completedAt,
      courseId,
    })
  }

  return activities
    .sort((a, b) => validTimestamp(b.occurredAt) - validTimestamp(a.occurredAt))
    .slice(0, 6)
}

function buildAssessmentInsight(
  quizzes: Quiz[],
  attempts: QuizAttempt[]
): AssessmentInsight | null {
  if (attempts.length === 0) return null
  const quizById = new Map(quizzes.map(quiz => [quiz.id, quiz]))
  const sortedAttempts = [...attempts].sort(
    (a, b) => validTimestamp(a.completedAt) - validTimestamp(b.completedAt)
  )
  const visibleAttempts = sortedAttempts.slice(-6).map((attempt, index) => ({
    id: attempt.id,
    label: `Attempt ${Math.max(1, sortedAttempts.length - 5 + index)}`,
    percentage: Math.round(attempt.percentage),
    completedAt: attempt.completedAt,
  }))
  const topicScores = new Map<string, { correct: number; total: number }>()
  for (const attempt of attempts) {
    const quiz = quizById.get(attempt.quizId)
    if (!quiz) continue
    for (const answer of attempt.answers) {
      const topic = quiz.questions
        .find(question => question.id === answer.questionId)
        ?.topic?.trim()
      if (!topic) continue
      const score = topicScores.get(topic) ?? { correct: 0, total: 0 }
      score.total++
      if (answer.isCorrect) score.correct++
      topicScores.set(topic, score)
    }
  }
  const weakTopics = [...topicScores]
    .map(([name, score]) => ({
      name,
      accuracy: Math.round((score.correct / score.total) * 100),
      answers: score.total,
    }))
    .filter(topic => topic.accuracy < 80)
    .sort((a, b) => a.accuracy - b.accuracy || b.answers - a.answers)
    .slice(0, 3)

  return {
    averageScore: Math.round(
      attempts.reduce((total, attempt) => total + attempt.percentage, 0) / attempts.length
    ),
    attempts: visibleAttempts,
    weakTopics,
  }
}

function buildReadingInsight(
  snapshot: OverviewDashboardSnapshot,
  sessions: StudySession[],
  now: Date
): ReadingInsight | null {
  const pdfIds = new Set(snapshot.pdfs.map(pdf => pdf.id))
  const readingSessions = sessions.filter(
    session =>
      (session.sessionType === 'pdf' || session.sessionType === 'mixed') &&
      validTimestamp(session.startTime) >= addLocalDays(startOfLocalDay(now), -30).getTime()
  )
  const pdfProgress = snapshot.videoProgress.filter(
    progress => pdfIds.has(progress.videoId) && (progress.currentPage ?? 0) > 0
  )
  if (readingSessions.length === 0 && pdfProgress.length === 0) return null

  const pdfById = new Map(snapshot.pdfs.map(pdf => [pdf.id, pdf]))
  const courseById = new Map(snapshot.courses.map(course => [course.id, course]))
  const latest = [...pdfProgress].sort(
    (a, b) => validTimestamp(b.updatedAt) - validTimestamp(a.updatedAt)
  )[0]
  const latestPdf = latest ? pdfById.get(latest.videoId) : undefined

  return {
    minutesLast30Days: Math.round(
      readingSessions.reduce((total, session) => total + session.duration, 0) / 60
    ),
    pagesReached: pdfProgress.reduce(
      (total, progress) => total + Math.max(0, progress.currentPage ?? 0),
      0
    ),
    documentsWithProgress: new Set(pdfProgress.map(progress => progress.videoId)).size,
    recentItem:
      latest && latestPdf
        ? {
            title: cleanContentTitle(latestPdf.filename),
            courseName: courseById.get(latest.courseId)?.name ?? 'Course',
            currentPage: latest.currentPage ?? 0,
            totalPages: latestPdf.pageCount,
          }
        : null,
  }
}

function buildInsights(
  snapshot: OverviewDashboardSnapshot,
  knowledgeTopics: ScoredTopic[],
  sessions: StudySession[],
  now: Date
): LearningInsights {
  return {
    mastery: [...knowledgeTopics]
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5)
      .map(topic => ({
        name: topic.name,
        score: topic.scoreResult.score,
        retention: topic.aggregateRetention,
        urgency: topic.urgency,
      })),
    assessment: buildAssessmentInsight(snapshot.quizzes, snapshot.quizAttempts),
    reading: buildReadingInsight(snapshot, sessions, now),
  }
}

export function buildOverviewDashboardModel(
  snapshot: OverviewDashboardSnapshot,
  knowledgeTopics: ScoredTopic[],
  now: Date
): ReadyOverviewDashboardModel {
  const sessions = completedSessions(snapshot.sessions)
  const courseProgress = buildCourseProgress({ ...snapshot, sessions })
  const today = buildToday(snapshot, knowledgeTopics, now)
  const progressByCourse = new Map(courseProgress.map(progress => [progress.courseId, progress]))
  const activeCourses = courseProgress
    .filter(progress => progress.completionPercent > 0 && progress.completionPercent < 100)
    .sort((a, b) => validTimestamp(b.lastActivityAt) - validTimestamp(a.lastActivityAt))
    .slice(0, 4)
  const sortedLibrary = [...snapshot.courses]
    .sort((a, b) => {
      const progressA = progressByCourse.get(a.id)
      const progressB = progressByCourse.get(b.id)
      const activeDifference = Number(b.status === 'active') - Number(a.status === 'active')
      return (
        activeDifference ||
        validTimestamp(progressB?.lastActivityAt) - validTimestamp(progressA?.lastActivityAt)
      )
    })
    .slice(0, 4)

  return {
    status: 'ready',
    learnerState: getLearnerState(snapshot.courses, sessions, now),
    learningFocus: buildLearningFocus({ ...snapshot, sessions }, courseProgress),
    today,
    metrics: buildMetrics(sessions, today.dueReviews, now),
    studyTrend: {
      sevenDays: buildStudyTrend(sessions, 7, now),
      thirtyDays: buildStudyTrend(sessions, 30, now),
    },
    activeCourses,
    heatmap: buildHeatmap(sessions, now),
    recentActivity: buildRecentActivity({ ...snapshot, sessions }),
    insights: buildInsights(snapshot, knowledgeTopics, sessions, now),
    library: sortedLibrary.map(course => ({
      course,
      completionPercent: progressByCourse.get(course.id)?.completionPercent ?? 0,
    })),
    allTags: [...new Set(snapshot.courses.flatMap(course => course.tags))].sort(),
  }
}

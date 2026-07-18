import { describe, expect, it } from 'vitest'
import type {
  Flashcard,
  ImportedCourse,
  ImportedPdf,
  ImportedVideo,
  StudySession,
  VideoProgress,
} from '@/data/types'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import {
  buildOverviewDashboardModel,
  type OverviewDashboardSnapshot,
} from '@/lib/overviewDashboard'
import { FIXED_DATE, getRelativeDate } from '../../../tests/utils/test-time'

const NOW = new Date(FIXED_DATE)

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'Decision Science',
    importedAt: getRelativeDate(-30),
    category: 'Psychology',
    tags: ['thinking'],
    status: 'active',
    videoCount: 2,
    pdfCount: 1,
    directoryHandle: null,
    ...overrides,
  }
}

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'video-1',
    courseId: 'course-1',
    filename: 'First_lesson.mp4',
    path: '/first.mp4',
    duration: 600,
    format: 'mp4',
    order: 1,
    fileHandle: null,
    ...overrides,
  }
}

function makePdf(overrides: Partial<ImportedPdf> = {}): ImportedPdf {
  return {
    id: 'pdf-1',
    courseId: 'course-1',
    filename: 'Workbook.pdf',
    path: '/workbook.pdf',
    pageCount: 100,
    fileHandle: null,
    ...overrides,
  }
}

function makeSession(id: string, daysAgo: number, duration = 1_800): StudySession {
  const startTime = getRelativeDate(daysAgo)
  const endTime = new Date(new Date(startTime).getTime() + duration * 1000).toISOString()
  return {
    id,
    courseId: 'course-1',
    contentItemId: 'video-1',
    startTime,
    endTime,
    duration,
    idleTime: 0,
    videosWatched: ['video-1'],
    lastActivity: endTime,
    sessionType: 'video',
  }
}

function makeSnapshot(
  overrides: Partial<OverviewDashboardSnapshot> = {}
): OverviewDashboardSnapshot {
  return {
    courses: [makeCourse()],
    videos: [makeVideo(), makeVideo({ id: 'video-2', filename: 'Second.mp4', order: 2 })],
    pdfs: [makePdf()],
    contentProgress: [],
    videoProgress: [],
    sessions: [],
    schedules: [],
    flashcards: [],
    quizzes: [],
    quizAttempts: [],
    ...overrides,
  }
}

function makeTopic(): ScoredTopic {
  return {
    name: 'Critical Thinking',
    canonicalName: 'critical-thinking',
    category: 'Psychology',
    courseIds: ['course-1'],
    scoreResult: {
      score: 48,
      tier: 'developing',
      confidence: 'medium',
      factors: {},
      signalsUsed: 2,
      effectiveWeights: {},
    } as unknown as ScoredTopic['scoreResult'],
    urgency: 82,
    daysSinceLastEngagement: 8,
    suggestedActions: ['Review Flashcards'],
    aggregateRetention: 71,
    predictedDecayDate: null,
    avgStability: 12,
  }
}

describe('buildOverviewDashboardModel', () => {
  it('classifies a learner with no imported courses as new', () => {
    const model = buildOverviewDashboardModel(makeSnapshot({ courses: [] }), [], NOW)
    expect(model.learnerState).toBe('new')
    expect(model.learningFocus).toBeNull()
    expect(model.library).toEqual([])
  })

  it('uses early, active, and returning states at the specified boundaries', () => {
    const early = buildOverviewDashboardModel(
      makeSnapshot({ sessions: [makeSession('one', -1), makeSession('two', -2)] }),
      [],
      NOW
    )
    const active = buildOverviewDashboardModel(
      makeSnapshot({
        sessions: [makeSession('one', -1), makeSession('two', -2), makeSession('three', -14)],
      }),
      [],
      NOW
    )
    const returning = buildOverviewDashboardModel(
      makeSnapshot({ sessions: [makeSession('old', -15)] }),
      [],
      NOW
    )

    expect(early.learnerState).toBe('early')
    expect(active.learnerState).toBe('active')
    expect(returning.learnerState).toBe('returning')
  })

  it('excludes orphaned sessions and reconciles current and previous seven-day metrics', () => {
    const orphan = { ...makeSession('orphan', -1, 7_200), endTime: undefined }
    const model = buildOverviewDashboardModel(
      makeSnapshot({
        sessions: [
          makeSession('current-1', -1, 1_800),
          makeSession('current-2', -2, 900),
          makeSession('previous', -8, 900),
          orphan,
        ],
      }),
      [],
      NOW
    )

    expect(model.metrics.studyMinutes).toEqual({
      value: 45,
      previousValue: 15,
      deltaPercent: 200,
    })
    expect(model.metrics.activeDays).toEqual({ value: 2, previousValue: 1, deltaPercent: 100 })
    expect(model.studyTrend.sevenDays[model.studyTrend.sevenDays.length - 2]?.minutes).toBe(30)
  })

  it('selects the most recently updated lesson and derives real course completion', () => {
    const progress: VideoProgress[] = [
      {
        courseId: 'course-1',
        videoId: 'video-1',
        currentTime: 300,
        completionPercentage: 95,
        updatedAt: getRelativeDate(-2),
      },
      {
        courseId: 'course-1',
        videoId: 'video-2',
        currentTime: 20,
        completionPercentage: 10,
        updatedAt: getRelativeDate(-1),
      },
    ]
    const model = buildOverviewDashboardModel(makeSnapshot({ videoProgress: progress }), [], NOW)

    expect(model.learningFocus).toMatchObject({
      lessonId: 'video-2',
      lessonTitle: 'Second',
      completionPercent: 33,
      completedItems: 1,
      totalItems: 3,
      variant: 'continue',
    })
  })

  it('counts currently due reviews and exposes the strongest source-backed focus area', () => {
    const dueCard = {
      id: 'card-1',
      courseId: 'course-1',
      front: 'Question',
      back: 'Answer',
      stability: 1,
      difficulty: 5,
      reps: 1,
      lapses: 0,
      state: 2,
      elapsed_days: 1,
      scheduled_days: 1,
      due: getRelativeDate(-1),
      createdAt: getRelativeDate(-10),
      updatedAt: getRelativeDate(-1),
    } satisfies Flashcard
    const futureCard = { ...dueCard, id: 'card-2', due: getRelativeDate(1) }
    const model = buildOverviewDashboardModel(
      makeSnapshot({ flashcards: [dueCard, futureCard] }),
      [makeTopic()],
      NOW
    )

    expect(model.metrics.reviewsDue).toBe(1)
    expect(model.today.focusArea).toEqual({
      name: 'Critical Thinking',
      score: 48,
      action: 'Review Flashcards',
    })
    expect(model.insights.mastery[0]).toMatchObject({ name: 'Critical Thinking', retention: 71 })
  })

  it('builds assessment and reading insights only from persisted evidence', () => {
    const quiz: Quiz = {
      id: 'quiz-1',
      lessonId: 'video-1',
      title: 'Thinking Check',
      description: '',
      questions: [
        {
          id: 'question-1',
          order: 1,
          type: 'multiple-choice',
          text: 'Question',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: '',
          points: 1,
          topic: 'Bias detection',
        },
      ],
      timeLimit: null,
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      createdAt: getRelativeDate(-20),
      updatedAt: getRelativeDate(-20),
    }
    const attempt: QuizAttempt = {
      id: 'attempt-1',
      quizId: quiz.id,
      answers: [
        {
          questionId: 'question-1',
          userAnswer: 'B',
          isCorrect: false,
          pointsEarned: 0,
          pointsPossible: 1,
        },
      ],
      score: 0,
      percentage: 60,
      passed: false,
      timeSpent: 30_000,
      completedAt: getRelativeDate(-1),
      startedAt: getRelativeDate(-1),
      timerAccommodation: 'standard',
    }
    const readingSession = {
      ...makeSession('reading', -2, 1_200),
      contentItemId: 'pdf-1',
      sessionType: 'pdf' as const,
    }
    const model = buildOverviewDashboardModel(
      makeSnapshot({
        quizzes: [quiz],
        quizAttempts: [attempt],
        sessions: [readingSession],
        videoProgress: [
          {
            courseId: 'course-1',
            videoId: 'pdf-1',
            currentTime: 0,
            currentPage: 24,
            completionPercentage: 24,
            updatedAt: getRelativeDate(-1),
          },
        ],
      }),
      [],
      NOW
    )

    expect(model.insights.assessment).toMatchObject({
      averageScore: 60,
      weakTopics: [{ name: 'Bias detection', accuracy: 0, answers: 1 }],
    })
    expect(model.insights.reading).toMatchObject({
      minutesLast30Days: 20,
      pagesReached: 24,
      documentsWithProgress: 1,
      recentItem: { title: 'Workbook', currentPage: 24, totalPages: 100 },
    })
    expect(model.heatmap).toHaveLength(84)
  })

  it('does not fabricate optional insights when no supporting records exist', () => {
    const model = buildOverviewDashboardModel(makeSnapshot(), [], NOW)
    expect(model.insights).toEqual({ mastery: [], assessment: null, reading: null })
    expect(model.recentActivity).toEqual([])
  })
})

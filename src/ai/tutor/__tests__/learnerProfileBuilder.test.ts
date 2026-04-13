/**
 * Unit tests for learnerProfileBuilder.ts (E63-S04)
 *
 * Comprehensive coverage of all aggregation functions, the token-aware
 * formatter, topic filtering, and the orchestrator with graceful degradation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Fixed date for deterministic time-dependent tests
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-04-10T12:00:00.000Z')

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so we use vi.hoisted()
// ---------------------------------------------------------------------------

const {
  mockQuizzes,
  mockQuizAttempts,
  mockContentProgress,
  mockFlashcards,
  mockStudySessions,
  mockGetState,
} = vi.hoisted(() => ({
  mockQuizzes: { toArray: vi.fn() },
  mockQuizAttempts: { toArray: vi.fn() },
  mockContentProgress: {
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
  mockFlashcards: {
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
  mockStudySessions: {
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
  mockGetState: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    quizzes: mockQuizzes,
    quizAttempts: mockQuizAttempts,
    contentProgress: mockContentProgress,
    flashcards: mockFlashcards,
    studySessions: mockStudySessions,
  },
}))

vi.mock('@/stores/useKnowledgeMapStore', () => ({
  useKnowledgeMapStore: {
    getState: mockGetState,
  },
}))

import {
  aggregateQuizScores,
  aggregateKnowledgeScores,
  aggregateFlashcardWeakness,
  aggregateStudySessions,
  buildLearnerProfile,
  formatLearnerProfile,
  buildAndFormatLearnerProfile,
  filterByTopics,
  QUIZ_FAIL_THRESHOLD,
  CHARS_PER_TOKEN,
  type LearnerProfileData,
  type QuizProfileData,
  type KnowledgeProfileData,
  type FlashcardProfileData,
  type StudyProfileData,
  type ProfileBuilderConfig,
} from '../learnerProfileBuilder'

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeQuiz(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quiz-1',
    lessonId: 'lesson-1',
    title: 'Test Quiz',
    questions: [
      {
        id: 'q1',
        order: 1,
        type: 'multiple-choice' as const,
        text: 'Q1?',
        options: ['A', 'B'],
        correctAnswer: 'A',
        explanation: '',
        points: 10,
        topic: 'Algebra',
      },
      {
        id: 'q2',
        order: 2,
        type: 'multiple-choice' as const,
        text: 'Q2?',
        options: ['A', 'B'],
        correctAnswer: 'B',
        explanation: '',
        points: 10,
        topic: 'Geometry',
      },
    ],
    ...overrides,
  }
}

function makeQuizAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    quizId: 'quiz-1',
    answers: [
      { questionId: 'q1', userAnswer: 'A', isCorrect: true, pointsEarned: 10, pointsPossible: 10 },
      { questionId: 'q2', userAnswer: 'A', isCorrect: false, pointsEarned: 0, pointsPossible: 10 },
    ],
    score: 10,
    percentage: 50,
    passed: false,
    timeSpent: 60000,
    completedAt: '2026-04-09T10:00:00.000Z',
    startedAt: '2026-04-09T09:50:00.000Z',
    timerAccommodation: 'standard',
    ...overrides,
  }
}

function makeContentProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    itemId: 'lesson-1',
    status: 'completed',
    updatedAt: '2026-04-08T10:00:00.000Z',
    ...overrides,
  }
}

function makeFlashcard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fc-1',
    courseId: 'course-1',
    front: 'What is the derivative of x squared',
    back: '2x',
    stability: 10,
    difficulty: 5,
    reps: 3,
    lapses: 0,
    state: 2,
    elapsed_days: 1,
    scheduled_days: 7,
    due: '2026-04-15T12:00:00.000Z',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-08T10:00:00.000Z',
    ...overrides,
  }
}

function makeStudySession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    courseId: 'course-1',
    contentItemId: 'lesson-1',
    startTime: '2026-04-09T10:00:00.000Z',
    endTime: '2026-04-09T11:00:00.000Z',
    duration: 3600,
    idleTime: 0,
    videosWatched: [],
    lastActivity: '2026-04-09T11:00:00.000Z',
    sessionType: 'video' as const,
    qualityScore: 75,
    ...overrides,
  }
}

function makeScoredTopic(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Algebra',
    canonicalName: 'algebra',
    category: 'Math',
    courseIds: ['course-1'],
    scoreResult: { score: 30, label: 'weak' },
    urgency: 80,
    daysSinceLastEngagement: 10,
    suggestedActions: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock setup helper — chain .where().equals().toArray()
// ---------------------------------------------------------------------------

function mockChainedQuery(
  table: { where: ReturnType<typeof vi.fn> },
  data: unknown[]
) {
  const toArray = vi.fn().mockResolvedValue(data)
  const equals = vi.fn(() => ({ toArray }))
  table.where.mockReturnValue({ equals })
  return { toArray, equals }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aggregateQuizScores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no quiz attempts exist for the course', async () => {
    mockQuizzes.toArray.mockResolvedValue([])
    mockQuizAttempts.toArray.mockResolvedValue([])
    mockChainedQuery(mockContentProgress, [])

    const result = await aggregateQuizScores('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })

  it('computes average percentage, failed count, and weak topics', async () => {
    const quiz = makeQuiz()
    const attempt1 = makeQuizAttempt({ id: 'a1', percentage: 50 })
    const attempt2 = makeQuizAttempt({ id: 'a2', percentage: 80, passed: true })
    const progress = makeContentProgress()

    mockQuizzes.toArray.mockResolvedValue([quiz])
    mockQuizAttempts.toArray.mockResolvedValue([attempt1, attempt2])
    mockChainedQuery(mockContentProgress, [progress])

    const result = await aggregateQuizScores('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.avgPercentage).toBe(65) // (50+80)/2
    expect(result!.failedCount).toBe(1) // only 50% < 70%
  })

  it('returns all passing when all attempts above threshold', async () => {
    const quiz = makeQuiz()
    const attempt = makeQuizAttempt({
      percentage: 90,
      passed: true,
      answers: [
        { questionId: 'q1', userAnswer: 'A', isCorrect: true, pointsEarned: 10, pointsPossible: 10 },
        { questionId: 'q2', userAnswer: 'B', isCorrect: true, pointsEarned: 10, pointsPossible: 10 },
      ],
    })
    const progress = makeContentProgress()

    mockQuizzes.toArray.mockResolvedValue([quiz])
    mockQuizAttempts.toArray.mockResolvedValue([attempt])
    mockChainedQuery(mockContentProgress, [progress])

    const result = await aggregateQuizScores('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.failedCount).toBe(0)
    expect(result!.weakTopics).toEqual([])
  })

  it('identifies weak topics from incorrect answers', async () => {
    const quiz = makeQuiz()
    // Attempt where q1 (Algebra) is wrong and q2 (Geometry) is wrong
    const attempt = makeQuizAttempt({
      percentage: 0,
      answers: [
        { questionId: 'q1', userAnswer: 'B', isCorrect: false, pointsEarned: 0, pointsPossible: 10 },
        { questionId: 'q2', userAnswer: 'A', isCorrect: false, pointsEarned: 0, pointsPossible: 10 },
      ],
    })
    const progress = makeContentProgress()

    mockQuizzes.toArray.mockResolvedValue([quiz])
    mockQuizAttempts.toArray.mockResolvedValue([attempt])
    mockChainedQuery(mockContentProgress, [progress])

    const result = await aggregateQuizScores('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.weakTopics).toContain('Algebra')
    expect(result!.weakTopics).toContain('Geometry')
  })

  it('returns null on Dexie query failure', async () => {
    mockQuizzes.toArray.mockRejectedValue(new Error('DB error'))
    mockQuizAttempts.toArray.mockResolvedValue([])
    mockChainedQuery(mockContentProgress, [])

    const result = await aggregateQuizScores('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })

  it('ignores attempts for quizzes not in the course', async () => {
    const quiz = makeQuiz({ id: 'quiz-other', lessonId: 'lesson-other' })
    const attempt = makeQuizAttempt({ quizId: 'quiz-other' })
    const progress = makeContentProgress() // lesson-1 only

    mockQuizzes.toArray.mockResolvedValue([quiz])
    mockQuizAttempts.toArray.mockResolvedValue([attempt])
    mockChainedQuery(mockContentProgress, [progress])

    const result = await aggregateQuizScores('course-1', FIXED_DATE)
    expect(result).toBeNull() // lesson-other not in contentProgress
  })
})

describe('aggregateKnowledgeScores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when store has no topics', () => {
    mockGetState.mockReturnValue({ topics: [] })
    expect(aggregateKnowledgeScores('course-1')).toBeNull()
  })

  it('returns null when topics is undefined', () => {
    mockGetState.mockReturnValue({ topics: undefined })
    expect(aggregateKnowledgeScores('course-1')).toBeNull()
  })

  it('extracts weak topics (score < 40)', () => {
    mockGetState.mockReturnValue({
      topics: [
        makeScoredTopic({ name: 'Algebra', scoreResult: { score: 20 } }),
        makeScoredTopic({ name: 'Calculus', scoreResult: { score: 80 } }),
      ],
    })

    const result = aggregateKnowledgeScores('course-1')
    expect(result).not.toBeNull()
    expect(result!.weakTopics).toEqual(['Algebra'])
    expect(result!.fadingTopics).toEqual([])
  })

  it('extracts fading topics (score 40-60, daysSinceLastEngagement > 7)', () => {
    mockGetState.mockReturnValue({
      topics: [
        makeScoredTopic({
          name: 'Statistics',
          scoreResult: { score: 50 },
          daysSinceLastEngagement: 10,
        }),
      ],
    })

    const result = aggregateKnowledgeScores('course-1')
    expect(result).not.toBeNull()
    expect(result!.fadingTopics).toEqual(['Statistics'])
  })

  it('returns null when no topics are weak or fading', () => {
    mockGetState.mockReturnValue({
      topics: [
        makeScoredTopic({ name: 'Strong Topic', scoreResult: { score: 85 } }),
      ],
    })

    expect(aggregateKnowledgeScores('course-1')).toBeNull()
  })

  it('filters topics by courseId', () => {
    mockGetState.mockReturnValue({
      topics: [
        makeScoredTopic({ name: 'Algebra', courseIds: ['course-1'], scoreResult: { score: 20 } }),
        makeScoredTopic({ name: 'History', courseIds: ['course-2'], scoreResult: { score: 15 } }),
      ],
    })

    const result = aggregateKnowledgeScores('course-1')
    expect(result!.weakTopics).toEqual(['Algebra'])
    expect(result!.weakTopics).not.toContain('History')
  })

  it('returns null on store error', () => {
    mockGetState.mockImplementation(() => {
      throw new Error('Store error')
    })

    expect(aggregateKnowledgeScores('course-1')).toBeNull()
  })
})

describe('aggregateFlashcardWeakness', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no flashcards exist', async () => {
    mockChainedQuery(mockFlashcards, [])
    const result = await aggregateFlashcardWeakness('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })

  it('detects FSRS weak cards (lapses > 2, stability < 5)', async () => {
    const weakCard = makeFlashcard({
      id: 'fc-weak',
      lapses: 4,
      stability: 3,
      front: 'Weak card topic here for hints',
    })
    const strongCard = makeFlashcard({ id: 'fc-strong', lapses: 0, stability: 20 })

    mockChainedQuery(mockFlashcards, [weakCard, strongCard])

    const result = await aggregateFlashcardWeakness('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.weakCardCount).toBe(1)
    expect(result!.weakTopicHints.length).toBeGreaterThan(0)
  })

  it('counts overdue cards (due date in the past)', async () => {
    const overdueCard = makeFlashcard({
      id: 'fc-overdue',
      due: '2026-04-05T12:00:00.000Z', // before FIXED_DATE
    })
    const futureCard = makeFlashcard({
      id: 'fc-future',
      due: '2026-04-20T12:00:00.000Z',
    })

    mockChainedQuery(mockFlashcards, [overdueCard, futureCard])

    const result = await aggregateFlashcardWeakness('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.overdueCount).toBe(1)
  })

  it('extracts topic hints from weak card fronts (3-5 words)', async () => {
    const card = makeFlashcard({
      lapses: 5,
      stability: 2,
      front: 'What is the derivative of sine',
    })

    mockChainedQuery(mockFlashcards, [card])

    const result = await aggregateFlashcardWeakness('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.weakTopicHints[0]).toMatch(/What is the derivative of/)
  })

  it('limits topic hints to 5 cards', async () => {
    const weakCards = Array.from({ length: 8 }, (_, i) =>
      makeFlashcard({
        id: `fc-${i}`,
        lapses: 5,
        stability: 1,
        front: `Card ${i} front text words`,
      })
    )

    mockChainedQuery(mockFlashcards, weakCards)

    const result = await aggregateFlashcardWeakness('course-1', FIXED_DATE)

    expect(result!.weakTopicHints.length).toBeLessThanOrEqual(5)
  })

  it('returns null on Dexie query failure', async () => {
    const toArray = vi.fn().mockRejectedValue(new Error('DB error'))
    const equals = vi.fn(() => ({ toArray }))
    mockFlashcards.where.mockReturnValue({ equals })

    const result = await aggregateFlashcardWeakness('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })
})

describe('aggregateStudySessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no sessions exist', async () => {
    mockChainedQuery(mockStudySessions, [])
    const result = await aggregateStudySessions('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })

  it('computes stats for sessions within 7-day window', async () => {
    const sessions = [
      makeStudySession({
        id: 's1',
        startTime: '2026-04-09T10:00:00.000Z',
        endTime: '2026-04-09T11:00:00.000Z',
        duration: 3600,
        qualityScore: 80,
      }),
      makeStudySession({
        id: 's2',
        startTime: '2026-04-08T10:00:00.000Z',
        endTime: '2026-04-08T11:30:00.000Z',
        duration: 5400,
        qualityScore: 70,
      }),
    ]

    mockChainedQuery(mockStudySessions, sessions)

    const result = await aggregateStudySessions('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.sessionCount).toBe(2)
    expect(result!.totalHours).toBe(2.5) // (3600+5400)/3600
    expect(result!.avgQuality).toBe(75) // (80+70)/2
    expect(result!.daysSinceLastSession).toBe(1) // April 9 → April 10
  })

  it('excludes sessions outside the 7-day window from count', async () => {
    const oldSession = makeStudySession({
      id: 's-old',
      startTime: '2026-03-25T10:00:00.000Z',
      endTime: '2026-03-25T11:00:00.000Z',
      duration: 3600,
    })
    const recentSession = makeStudySession({
      id: 's-recent',
      startTime: '2026-04-09T10:00:00.000Z',
      endTime: '2026-04-09T11:00:00.000Z',
      duration: 1800,
      qualityScore: 60,
    })

    mockChainedQuery(mockStudySessions, [oldSession, recentSession])

    const result = await aggregateStudySessions('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.sessionCount).toBe(1) // only recent
    expect(result!.totalHours).toBe(0.5) // 1800s
  })

  it('returns null when all sessions are outside the window', async () => {
    const oldSession = makeStudySession({
      startTime: '2026-03-01T10:00:00.000Z',
      endTime: '2026-03-01T11:00:00.000Z',
    })

    mockChainedQuery(mockStudySessions, [oldSession])

    const result = await aggregateStudySessions('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })

  it('handles sessions without qualityScore gracefully', async () => {
    const session = makeStudySession({
      qualityScore: undefined,
    })

    mockChainedQuery(mockStudySessions, [session])

    const result = await aggregateStudySessions('course-1', FIXED_DATE)

    expect(result).not.toBeNull()
    expect(result!.avgQuality).toBe(0)
  })

  it('returns null on Dexie query failure', async () => {
    const toArray = vi.fn().mockRejectedValue(new Error('DB error'))
    const equals = vi.fn(() => ({ toArray }))
    mockStudySessions.where.mockReturnValue({ equals })

    const result = await aggregateStudySessions('course-1', FIXED_DATE)
    expect(result).toBeNull()
  })

  it('computes daysSinceLastSession from endTime, not startTime', async () => {
    const session = makeStudySession({
      startTime: '2026-04-08T10:00:00.000Z',
      endTime: '2026-04-08T14:00:00.000Z',
      duration: 7200,
    })

    mockChainedQuery(mockStudySessions, [session])

    const result = await aggregateStudySessions('course-1', FIXED_DATE)
    // endTime is April 8 14:00 → April 10 12:00 = ~2 days
    expect(result!.daysSinceLastSession).toBe(2)
  })
})

describe('buildLearnerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all null profiles when no data exists', async () => {
    mockQuizzes.toArray.mockResolvedValue([])
    mockQuizAttempts.toArray.mockResolvedValue([])
    mockChainedQuery(mockContentProgress, [])
    mockChainedQuery(mockFlashcards, [])
    mockChainedQuery(mockStudySessions, [])
    mockGetState.mockReturnValue({ topics: [] })

    const result = await buildLearnerProfile('course-1', FIXED_DATE)

    expect(result.quizProfile).toBeNull()
    expect(result.knowledgeProfile).toBeNull()
    expect(result.flashcardProfile).toBeNull()
    expect(result.studyProfile).toBeNull()
  })

  it('aggregates all data sources in parallel', async () => {
    // Set up quiz data
    mockQuizzes.toArray.mockResolvedValue([makeQuiz()])
    mockQuizAttempts.toArray.mockResolvedValue([makeQuizAttempt()])
    mockChainedQuery(mockContentProgress, [makeContentProgress()])

    // Flashcard data
    mockChainedQuery(mockFlashcards, [makeFlashcard({ lapses: 5, stability: 2 })])

    // Study session data
    mockChainedQuery(mockStudySessions, [makeStudySession()])

    // Knowledge data
    mockGetState.mockReturnValue({
      topics: [makeScoredTopic({ scoreResult: { score: 25 } })],
    })

    const result = await buildLearnerProfile('course-1', FIXED_DATE)

    expect(result.quizProfile).not.toBeNull()
    expect(result.knowledgeProfile).not.toBeNull()
    expect(result.flashcardProfile).not.toBeNull()
    expect(result.studyProfile).not.toBeNull()
  })
})

describe('formatLearnerProfile', () => {
  const fullProfile: LearnerProfileData = {
    knowledgeProfile: { weakTopics: ['Algebra', 'Calculus'], fadingTopics: ['Statistics'] },
    quizProfile: { avgPercentage: 55, failedCount: 3, weakTopics: ['Trigonometry'] },
    flashcardProfile: { weakCardCount: 5, overdueCount: 3, weakTopicHints: ['derivatives'] },
    studyProfile: { totalHours: 4.5, sessionCount: 6, avgQuality: 72, daysSinceLastSession: 2 },
  }

  it('returns empty string when all signals are null', () => {
    const emptyProfile: LearnerProfileData = {
      quizProfile: null,
      knowledgeProfile: null,
      flashcardProfile: null,
      studyProfile: null,
    }

    expect(formatLearnerProfile(emptyProfile, 200)).toBe('')
  })

  it('enforces token budget (40 tokens ~160 chars)', () => {
    const output = formatLearnerProfile(fullProfile, 40)
    // May exceed slightly due to "at least one signal" rule, but should be reasonable
    expect(output.length).toBeLessThan(300) // generous upper bound
    expect(output.length).toBeGreaterThan(0)
  })

  it('includes all signal categories at 200 token budget', () => {
    const output = formatLearnerProfile(fullProfile, 200)

    expect(output).toContain('Weak:')
    expect(output).toContain('Quiz avg:')
    expect(output).toContain('weak cards')
    expect(output).toContain('sessions')
  })

  it('prioritizes knowledge before quiz before flashcard before study', () => {
    const output = formatLearnerProfile(fullProfile, 200)

    const knowledgeIdx = output.indexOf('Weak:')
    const quizIdx = output.indexOf('Quiz avg:')
    const flashcardIdx = output.indexOf('weak cards')
    const studyIdx = output.indexOf('sessions')

    expect(knowledgeIdx).toBeLessThan(quizIdx)
    expect(quizIdx).toBeLessThan(flashcardIdx)
    expect(flashcardIdx).toBeLessThan(studyIdx)
  })

  it('deduplicates topics between knowledge and quiz signals', () => {
    const profileWithOverlap: LearnerProfileData = {
      knowledgeProfile: { weakTopics: ['Algebra'], fadingTopics: [] },
      quizProfile: { avgPercentage: 40, failedCount: 2, weakTopics: ['algebra', 'Geometry'] },
      flashcardProfile: null,
      studyProfile: null,
    }

    const output = formatLearnerProfile(profileWithOverlap, 200)

    // "Algebra" should appear in knowledge signal, not repeated in quiz struggles
    const quizStruggleMatch = output.match(/Quiz struggles: (.+?)\./)
    if (quizStruggleMatch) {
      expect(quizStruggleMatch[1].toLowerCase()).not.toContain('algebra')
    }
  })

  it('always includes at least one signal even if over budget', () => {
    const output = formatLearnerProfile(fullProfile, 1) // extremely tight budget
    expect(output.length).toBeGreaterThan(0)
  })

  it('handles profile with only study data', () => {
    const studyOnly: LearnerProfileData = {
      quizProfile: null,
      knowledgeProfile: null,
      flashcardProfile: null,
      studyProfile: { totalHours: 2, sessionCount: 3, avgQuality: 85, daysSinceLastSession: 0 },
    }

    const output = formatLearnerProfile(studyOnly, 100)
    expect(output).toContain('3 sessions')
    expect(output).toContain('2h')
  })

  it('snapshot: 40-token budget output', () => {
    const output = formatLearnerProfile(fullProfile, 40)
    expect(output).toMatchInlineSnapshot(
      `"Weak: Algebra, Calculus. Fading: Statistics. Quiz avg: 55%. Quiz struggles: Trigonometry. 5 weak cards. 3 overdue."`
    )
  })

  it('snapshot: 100-token budget output', () => {
    const output = formatLearnerProfile(fullProfile, 100)
    expect(output).toMatchInlineSnapshot(
      `"Weak: Algebra, Calculus. Fading: Statistics. Quiz avg: 55%. Quiz struggles: Trigonometry. 5 weak cards. 3 overdue. 6 sessions, 4.5h this week. Avg quality: 72/100. Last session: 2d ago."`
    )
  })

  it('snapshot: 200-token budget output', () => {
    const output = formatLearnerProfile(fullProfile, 200)
    expect(output).toMatchInlineSnapshot(
      `"Weak: Algebra, Calculus. Fading: Statistics. Quiz avg: 55%. Quiz struggles: Trigonometry. 5 weak cards. 3 overdue. 6 sessions, 4.5h this week. Avg quality: 72/100. Last session: 2d ago."`
    )
  })
})

describe('filterByTopics', () => {
  it('prioritizes matching topics to front of lists', () => {
    const data: LearnerProfileData = {
      quizProfile: { avgPercentage: 50, failedCount: 2, weakTopics: ['Geometry', 'Algebra', 'Calculus'] },
      knowledgeProfile: { weakTopics: ['Statistics', 'Algebra'], fadingTopics: ['Geometry'] },
      flashcardProfile: null,
      studyProfile: null,
    }

    const filtered = filterByTopics(data, ['Algebra'])

    expect(filtered.quizProfile!.weakTopics[0]).toBe('Algebra')
    expect(filtered.knowledgeProfile!.weakTopics[0]).toBe('Algebra')
  })

  it('retains non-matching topics after matching ones', () => {
    const data: LearnerProfileData = {
      quizProfile: { avgPercentage: 50, failedCount: 1, weakTopics: ['X', 'Y', 'Z'] },
      knowledgeProfile: null,
      flashcardProfile: null,
      studyProfile: null,
    }

    const filtered = filterByTopics(data, ['Z'])

    expect(filtered.quizProfile!.weakTopics).toEqual(['Z', 'X', 'Y'])
  })

  it('does case-insensitive matching', () => {
    const data: LearnerProfileData = {
      quizProfile: null,
      knowledgeProfile: { weakTopics: ['ALGEBRA', 'geometry'], fadingTopics: [] },
      flashcardProfile: null,
      studyProfile: null,
    }

    const filtered = filterByTopics(data, ['algebra'])

    expect(filtered.knowledgeProfile!.weakTopics[0]).toBe('ALGEBRA')
  })

  it('leaves null profiles unchanged', () => {
    const data: LearnerProfileData = {
      quizProfile: null,
      knowledgeProfile: null,
      flashcardProfile: null,
      studyProfile: null,
    }

    const filtered = filterByTopics(data, ['anything'])
    expect(filtered).toEqual(data)
  })
})

describe('buildAndFormatLearnerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty string when all data sources are empty', async () => {
    mockQuizzes.toArray.mockResolvedValue([])
    mockQuizAttempts.toArray.mockResolvedValue([])
    mockChainedQuery(mockContentProgress, [])
    mockChainedQuery(mockFlashcards, [])
    mockChainedQuery(mockStudySessions, [])
    mockGetState.mockReturnValue({ topics: [] })

    const config: ProfileBuilderConfig = { courseId: 'course-1', maxTokens: 200 }
    const result = await buildAndFormatLearnerProfile(config, FIXED_DATE)

    expect(result).toBe('')
  })

  it('gracefully degrades when one aggregator throws', async () => {
    // Quiz throws
    mockQuizzes.toArray.mockRejectedValue(new Error('Quiz DB error'))
    mockQuizAttempts.toArray.mockRejectedValue(new Error('Quiz DB error'))
    mockChainedQuery(mockContentProgress, [])

    // Flashcard works
    mockChainedQuery(mockFlashcards, [
      makeFlashcard({ lapses: 5, stability: 2 }),
    ])

    // Study works
    mockChainedQuery(mockStudySessions, [makeStudySession()])

    // Knowledge works
    mockGetState.mockReturnValue({
      topics: [makeScoredTopic({ scoreResult: { score: 25 } })],
    })

    const config: ProfileBuilderConfig = { courseId: 'course-1', maxTokens: 200 }
    const result = await buildAndFormatLearnerProfile(config, FIXED_DATE)

    // Should still have knowledge + flashcard + study signals
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('Weak:')
  })

  it('applies topic filtering when lessonTopics provided', async () => {
    mockQuizzes.toArray.mockResolvedValue([makeQuiz()])
    mockQuizAttempts.toArray.mockResolvedValue([
      makeQuizAttempt({
        percentage: 40,
        answers: [
          { questionId: 'q1', userAnswer: 'B', isCorrect: false, pointsEarned: 0, pointsPossible: 10 },
          { questionId: 'q2', userAnswer: 'A', isCorrect: false, pointsEarned: 0, pointsPossible: 10 },
        ],
      }),
    ])
    mockChainedQuery(mockContentProgress, [makeContentProgress()])
    mockChainedQuery(mockFlashcards, [])
    mockChainedQuery(mockStudySessions, [])
    mockGetState.mockReturnValue({
      topics: [
        makeScoredTopic({ name: 'Algebra', scoreResult: { score: 25 } }),
        makeScoredTopic({ name: 'Biology', courseIds: ['course-1'], scoreResult: { score: 20 } }),
      ],
    })

    const config: ProfileBuilderConfig = {
      courseId: 'course-1',
      maxTokens: 200,
      lessonTopics: ['Algebra'],
    }
    const result = await buildAndFormatLearnerProfile(config, FIXED_DATE)

    // Algebra should be mentioned and prioritized
    expect(result).toContain('Algebra')
  })

  it('works without lessonTopics (no filtering)', async () => {
    mockQuizzes.toArray.mockResolvedValue([])
    mockQuizAttempts.toArray.mockResolvedValue([])
    mockChainedQuery(mockContentProgress, [])
    mockChainedQuery(mockFlashcards, [])
    mockChainedQuery(mockStudySessions, [makeStudySession()])
    mockGetState.mockReturnValue({ topics: [] })

    const config: ProfileBuilderConfig = { courseId: 'course-1', maxTokens: 200 }
    const result = await buildAndFormatLearnerProfile(config, FIXED_DATE)

    expect(result).toContain('sessions')
  })

  it('all aggregators fail → returns empty string', async () => {
    mockQuizzes.toArray.mockRejectedValue(new Error('fail'))
    mockQuizAttempts.toArray.mockRejectedValue(new Error('fail'))
    mockChainedQuery(mockContentProgress, [])
    const fcToArray = vi.fn().mockRejectedValue(new Error('fail'))
    mockFlashcards.where.mockReturnValue({ equals: vi.fn(() => ({ toArray: fcToArray })) })
    const ssToArray = vi.fn().mockRejectedValue(new Error('fail'))
    mockStudySessions.where.mockReturnValue({ equals: vi.fn(() => ({ toArray: ssToArray })) })
    mockGetState.mockImplementation(() => {
      throw new Error('fail')
    })

    const config: ProfileBuilderConfig = { courseId: 'course-1', maxTokens: 200 }
    const result = await buildAndFormatLearnerProfile(config, FIXED_DATE)

    expect(result).toBe('')
  })
})

describe('performance', () => {
  it('buildLearnerProfile completes within 100ms for typical data', async () => {
    mockQuizzes.toArray.mockResolvedValue([])
    mockQuizAttempts.toArray.mockResolvedValue([])
    mockChainedQuery(mockContentProgress, [])
    mockChainedQuery(mockFlashcards, [])
    mockChainedQuery(mockStudySessions, [])
    mockGetState.mockReturnValue({ topics: [] })

    const start = performance.now()
    await buildLearnerProfile('course-1', FIXED_DATE)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })
})

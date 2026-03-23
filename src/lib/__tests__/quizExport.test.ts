/**
 * Unit tests for quizExport.ts (E18-S10, QFR47)
 *
 * Tests cover:
 *   - formatTimeSpent: ms → "M:SS"
 *   - calculateSummaryStats: average, best, total
 *   - loadAllQuizExportData: DB query, empty result, filters quizzes with no attempts
 *   - exportQuizResultsCsv: zip download triggered with correct filenames
 *   - exportQuizResultsPdf: PDF blob download triggered
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTimeSpent,
  calculateSummaryStats,
  loadAllQuizExportData,
  exportQuizResultsCsv,
  exportQuizResultsPdf,
} from '@/lib/quizExport'
import {
  makeQuestion,
  makeQuiz,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../../../tests/support/fixtures/factories/quiz-factory'
import { db } from '@/db'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/db', () => ({
  db: {
    quizzes: {
      toArray: vi.fn(),
    },
    quizAttempts: {
      where: vi.fn(),
    },
  },
}))

vi.mock('@/lib/fileDownload', () => ({
  downloadZip: vi.fn().mockResolvedValue(undefined),
  downloadBlob: vi.fn(),
}))

// Mock jsPDF + autotable since jsdom can't run canvas-based PDF generation
vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 210 } }
    lastAutoTable = { finalY: 100 }
    setFontSize = vi.fn()
    setFont = vi.fn()
    text = vi.fn()
    addPage = vi.fn()
    output = vi.fn().mockReturnValue(new ArrayBuffer(8))
    autoTable = vi.fn()
  }
  return { default: MockJsPDF }
})

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))

const mockQuizzesToArray = db.quizzes.toArray as ReturnType<typeof vi.fn>
const mockAttemptsWhere = db.quizAttempts.where as ReturnType<typeof vi.fn>

function setupAttemptsWhere(attempts: ReturnType<typeof makeAttempt>[]) {
  mockAttemptsWhere.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      sortBy: vi.fn().mockResolvedValue(attempts),
    }),
  })
}

// ---------------------------------------------------------------------------
// formatTimeSpent
// ---------------------------------------------------------------------------

describe('formatTimeSpent', () => {
  it('formats 0ms as "0:00"', () => {
    expect(formatTimeSpent(0)).toBe('0:00')
  })

  it('formats 30000ms as "0:30"', () => {
    expect(formatTimeSpent(30000)).toBe('0:30')
  })

  it('formats 125000ms as "2:05"', () => {
    expect(formatTimeSpent(125000)).toBe('2:05')
  })

  it('formats 3600000ms (1 hour) as "60:00"', () => {
    expect(formatTimeSpent(3600000)).toBe('60:00')
  })

  it('pads seconds with leading zero', () => {
    expect(formatTimeSpent(61000)).toBe('1:01')
  })
})

// ---------------------------------------------------------------------------
// calculateSummaryStats
// ---------------------------------------------------------------------------

describe('calculateSummaryStats', () => {
  it('returns zeros for empty bundles', () => {
    const stats = calculateSummaryStats([])
    expect(stats).toEqual({ totalAttempts: 0, averageScore: 0, bestScore: 0 })
  })

  it('calculates correct stats for single attempt', () => {
    const quiz = makeQuiz()
    const attempt = makeAttempt({ quizId: quiz.id, percentage: 80 })
    const stats = calculateSummaryStats([{ quiz, attempts: [attempt] }])
    expect(stats.totalAttempts).toBe(1)
    expect(stats.averageScore).toBe(80)
    expect(stats.bestScore).toBe(80)
  })

  it('calculates average and best across multiple attempts', () => {
    const quiz = makeQuiz()
    const attempts = [
      makeAttempt({ quizId: quiz.id, percentage: 60 }),
      makeAttempt({ quizId: quiz.id, percentage: 75 }),
      makeAttempt({ quizId: quiz.id, percentage: 90 }),
      makeAttempt({ quizId: quiz.id, percentage: 80 }),
    ]
    const stats = calculateSummaryStats([{ quiz, attempts }])
    expect(stats.totalAttempts).toBe(4)
    // average = (60+75+90+80)/4 = 76.25
    expect(stats.averageScore).toBe(76.3)
    expect(stats.bestScore).toBe(90)
  })

  it('aggregates attempts across multiple quizzes', () => {
    const quiz1 = makeQuiz()
    const quiz2 = makeQuiz()
    const bundles = [
      { quiz: quiz1, attempts: [makeAttempt({ percentage: 50 }), makeAttempt({ percentage: 70 })] },
      { quiz: quiz2, attempts: [makeAttempt({ percentage: 90 })] },
    ]
    const stats = calculateSummaryStats(bundles)
    expect(stats.totalAttempts).toBe(3)
    expect(stats.bestScore).toBe(90)
  })
})

// ---------------------------------------------------------------------------
// loadAllQuizExportData
// ---------------------------------------------------------------------------

describe('loadAllQuizExportData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no quizzes exist', async () => {
    mockQuizzesToArray.mockResolvedValue([])
    const result = await loadAllQuizExportData()
    expect(result).toEqual([])
    expect(mockAttemptsWhere).not.toHaveBeenCalled()
  })

  it('returns empty array when quizzes have no attempts', async () => {
    const quiz = makeQuiz()
    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([])

    const result = await loadAllQuizExportData()
    expect(result).toEqual([])
  })

  it('returns bundles for quizzes with attempts', async () => {
    const quiz = makeQuiz()
    const attempts = [makeAttempt({ quizId: quiz.id }), makeAttempt({ quizId: quiz.id })]
    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere(attempts)

    const result = await loadAllQuizExportData()
    expect(result).toHaveLength(1)
    expect(result[0].quiz).toEqual(quiz)
    expect(result[0].attempts).toHaveLength(2)
  })

  it('queries attempts by quizId', async () => {
    const quiz = makeQuiz({ id: 'quiz-abc' })
    const attempt = makeAttempt({ quizId: quiz.id })
    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([attempt])

    await loadAllQuizExportData()

    expect(mockAttemptsWhere).toHaveBeenCalledWith('quizId')
  })

  it('filters out quizzes with no attempts, keeps those with attempts', async () => {
    const quiz1 = makeQuiz({ id: 'quiz-with-attempts' })
    const quiz2 = makeQuiz({ id: 'quiz-no-attempts' })

    mockQuizzesToArray.mockResolvedValue([quiz1, quiz2])

    // Return attempts for quiz1, empty for quiz2
    mockAttemptsWhere
      .mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([makeAttempt({ quizId: quiz1.id })]),
        }),
      })
      .mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          sortBy: vi.fn().mockResolvedValue([]),
        }),
      })

    const result = await loadAllQuizExportData()
    expect(result).toHaveLength(1)
    expect(result[0].quiz.id).toBe('quiz-with-attempts')
  })
})

// ---------------------------------------------------------------------------
// exportQuizResultsCsv
// ---------------------------------------------------------------------------

describe('exportQuizResultsCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls downloadZip with two CSV files', async () => {
    const { downloadZip } = await import('@/lib/fileDownload')

    const q1 = makeQuestion({ id: 'q1', text: 'What is 2+2?', correctAnswer: '4' })
    const quiz = makeQuiz({ id: 'quiz-1', title: 'Math Quiz', questions: [q1] })
    const attempt = makeAttempt({
      quizId: quiz.id,
      answers: [makeCorrectAnswer('q1')],
      percentage: 100,
      passed: true,
      timeSpent: 60000,
      completedAt: '2026-01-15T10:00:00.000Z',
    })

    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([attempt])

    await exportQuizResultsCsv()

    expect(downloadZip).toHaveBeenCalledOnce()
    const [files] = (downloadZip as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(files).toHaveLength(2)
    expect(files[0].name).toBe('quiz-attempts.csv')
    expect(files[1].name).toBe('quiz-questions.csv')
  })

  it('includes quiz title in attempts CSV', async () => {
    const { downloadZip } = await import('@/lib/fileDownload')

    const q1 = makeQuestion({ id: 'q1' })
    const quiz = makeQuiz({ title: 'History, Ancient & Modern', questions: [q1] })
    const attempt = makeAttempt({ quizId: quiz.id, answers: [], percentage: 75, passed: true })

    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([attempt])

    await exportQuizResultsCsv()

    const [files] = (downloadZip as ReturnType<typeof vi.fn>).mock.calls[0]
    // Title with comma should be quoted per RFC 4180
    expect(files[0].content).toContain('"History, Ancient & Modern"')
  })

  it('uses correct filename pattern with date', async () => {
    const { downloadZip } = await import('@/lib/fileDownload')

    mockQuizzesToArray.mockResolvedValue([])
    setupAttemptsWhere([])

    await exportQuizResultsCsv()

    const [, filename] = (downloadZip as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(filename).toMatch(/^knowlune-quiz-results-\d{4}-\d{2}-\d{2}\.zip$/)
  })

  it('includes pass/fail status in attempts CSV', async () => {
    const { downloadZip } = await import('@/lib/fileDownload')

    const q1 = makeQuestion({ id: 'q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const passAttempt = makeAttempt({ quizId: quiz.id, answers: [], percentage: 80, passed: true })
    const failAttempt = makeAttempt({ quizId: quiz.id, answers: [], percentage: 40, passed: false })

    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([passAttempt, failAttempt])

    await exportQuizResultsCsv()

    const [files] = (downloadZip as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(files[0].content).toContain('Pass')
    expect(files[0].content).toContain('Fail')
  })

  it('formats multiple-select answers with comma separation', async () => {
    const { downloadZip } = await import('@/lib/fileDownload')

    const q1 = makeQuestion({
      id: 'q1',
      type: 'multiple-select',
      correctAnswer: ['Option A', 'Option C'],
    })
    const quiz = makeQuiz({ questions: [q1] })
    const attempt = makeAttempt({
      quizId: quiz.id,
      answers: [
        {
          questionId: 'q1',
          userAnswer: ['Option A', 'Option C'],
          isCorrect: true,
          pointsEarned: 1,
          pointsPossible: 1,
        },
      ],
    })

    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([attempt])

    await exportQuizResultsCsv()

    const [files] = (downloadZip as ReturnType<typeof vi.fn>).mock.calls[0]
    // "Option A, Option C" contains a comma → must be RFC 4180 quoted
    expect(files[1].content).toContain('"Option A, Option C"')
  })

  it('produces correct CSV headers', async () => {
    const { downloadZip } = await import('@/lib/fileDownload')

    mockQuizzesToArray.mockResolvedValue([])
    setupAttemptsWhere([])

    await exportQuizResultsCsv()

    const [files] = (downloadZip as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(files[0].content).toContain('Quiz Name,Date,Time Spent,Score (%),Pass/Fail,Score')
    expect(files[1].content).toContain(
      'Quiz Name,Attempt Date,Question,Your Answer,Correct Answer,Result'
    )
  })
})

// ---------------------------------------------------------------------------
// exportQuizResultsPdf
// ---------------------------------------------------------------------------

describe('exportQuizResultsPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls downloadBlob with a PDF blob', async () => {
    const { downloadBlob } = await import('@/lib/fileDownload')

    const q1 = makeQuestion({ id: 'q1' })
    const quiz = makeQuiz({ title: 'Test Quiz', questions: [q1] })
    const attempt = makeAttempt({
      quizId: quiz.id,
      answers: [makeCorrectAnswer('q1')],
      percentage: 90,
      passed: true,
    })

    mockQuizzesToArray.mockResolvedValue([quiz])
    setupAttemptsWhere([attempt])

    await exportQuizResultsPdf()

    expect(downloadBlob).toHaveBeenCalledOnce()
    const [blob, filename] = (downloadBlob as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(filename).toMatch(/^knowlune-quiz-results-\d{4}-\d{2}-\d{2}\.pdf$/)
  })

  it('generates PDF even with empty data', async () => {
    const { downloadBlob } = await import('@/lib/fileDownload')

    mockQuizzesToArray.mockResolvedValue([])
    setupAttemptsWhere([])

    await exportQuizResultsPdf()

    expect(downloadBlob).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// makeCorrectAnswer / makeWrongAnswer usage
// (verify factory compatibility)
// ---------------------------------------------------------------------------

describe('quiz factory answer helpers', () => {
  it('makeCorrectAnswer creates a correct answer', () => {
    const answer = makeCorrectAnswer('q1')
    expect(answer.questionId).toBe('q1')
    expect(answer.isCorrect).toBe(true)
  })

  it('makeWrongAnswer creates an incorrect answer', () => {
    const answer = makeWrongAnswer('q1')
    expect(answer.questionId).toBe('q1')
    expect(answer.isCorrect).toBe(false)
  })
})

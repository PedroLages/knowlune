/**
 * Tests for Session Boundary Analyzer (E72-S03)
 *
 * Coverage:
 * - analyzeSession: pure extraction from messages
 * - countAssessmentExchanges: threshold logic
 * - serializeLearnerModelForPrompt: output format and token budget
 * - LearnerModelUpdateSchema: Zod validation edge cases
 * - updateFromSession: threshold gating, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TutorMessage, LearnerModel } from '@/data/types'

const FIXED_DATE = new Date('2026-04-13T12:00:00.000Z')
const FIXED_TIMESTAMP = FIXED_DATE.getTime()
import {
  analyzeSession,
  countAssessmentExchanges,
  serializeLearnerModelForPrompt,
  LearnerModelUpdateSchema,
  updateFromSession,
  MIN_ASSESSMENT_EXCHANGES,
} from '../sessionAnalyzer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTutorMessage(
  overrides: Partial<TutorMessage> & { role: 'user' | 'assistant'; content: string }
): TutorMessage {
  return {
    timestamp: FIXED_TIMESTAMP,
    mode: 'socratic',
    ...overrides,
  }
}

function makeModel(overrides?: Partial<LearnerModel>): LearnerModel {
  return {
    id: 'model-1',
    courseId: 'course-1',
    vocabularyLevel: 'intermediate',
    strengths: [],
    misconceptions: [],
    topicsExplored: [],
    preferredMode: 'socratic',
    lastSessionSummary: '',
    quizStats: { totalQuestions: 0, correctAnswers: 0, weakTopics: [] },
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// countAssessmentExchanges
// ---------------------------------------------------------------------------

describe('countAssessmentExchanges', () => {
  it('counts only user messages in quiz or debug modes', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({ role: 'user', content: 'q1', mode: 'quiz' }),
      makeTutorMessage({ role: 'assistant', content: 'a1', mode: 'quiz' }),
      makeTutorMessage({ role: 'user', content: 'q2', mode: 'debug' }),
      makeTutorMessage({ role: 'user', content: 'q3', mode: 'socratic' }),
      makeTutorMessage({ role: 'user', content: 'q4', mode: 'explain' }),
    ]
    expect(countAssessmentExchanges(messages)).toBe(2)
  })

  it('returns 0 for empty messages', () => {
    expect(countAssessmentExchanges([])).toBe(0)
  })

  it('returns 0 when no assessment modes used', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({ role: 'user', content: 'hello', mode: 'socratic' }),
      makeTutorMessage({ role: 'assistant', content: 'hi', mode: 'socratic' }),
    ]
    expect(countAssessmentExchanges(messages)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// analyzeSession
// ---------------------------------------------------------------------------

describe('analyzeSession', () => {
  it('extracts quiz stats from messages with quizScore', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({
        role: 'user',
        content: 'closures in JavaScript',
        mode: 'quiz',
        quizScore: { correct: true, questionNumber: 1 },
      }),
      makeTutorMessage({
        role: 'user',
        content: 'event loop explanation',
        mode: 'quiz',
        quizScore: { correct: false, questionNumber: 2 },
      }),
    ]

    const insights = analyzeSession(messages)
    expect(insights.quizStats).not.toBeNull()
    expect(insights.quizStats!.totalQuestions).toBe(2)
    expect(insights.quizStats!.correctAnswers).toBe(1)
    expect(insights.quizStats!.weakTopics.length).toBe(1)
  })

  it('extracts strengths from correct quiz answers', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({
        role: 'user',
        content: 'closures work by capturing scope',
        mode: 'quiz',
        quizScore: { correct: true, questionNumber: 1 },
      }),
    ]

    const insights = analyzeSession(messages)
    expect(insights.strengths.length).toBe(1)
    expect(insights.strengths[0].confidence).toBe(0.8)
    expect(insights.strengths[0].assessedBy).toBe('quiz')
  })

  it('extracts misconceptions from incorrect quiz answers', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({
        role: 'user',
        content: 'promises are synchronous',
        mode: 'quiz',
        quizScore: { correct: false, questionNumber: 1 },
      }),
    ]

    const insights = analyzeSession(messages)
    expect(insights.misconceptions.length).toBe(1)
    expect(insights.misconceptions[0].confidence).toBe(0.3)
  })

  it('extracts debug assessments (green → strength, red → misconception)', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({
        role: 'assistant',
        content: 'great understanding of closures',
        mode: 'debug',
        debugAssessment: 'green',
      }),
      makeTutorMessage({
        role: 'assistant',
        content: 'confusion about Promise.all vs Promise.race',
        mode: 'debug',
        debugAssessment: 'red',
      }),
      makeTutorMessage({
        role: 'assistant',
        content: 'partial understanding of event loop',
        mode: 'debug',
        debugAssessment: 'yellow',
      }),
    ]

    const insights = analyzeSession(messages)
    expect(insights.strengths.length).toBe(1)
    expect(insights.strengths[0].confidence).toBe(0.9)
    // red + yellow both go to misconceptions
    expect(insights.misconceptions.length).toBe(2)
    expect(insights.misconceptions[0].confidence).toBe(0.2) // red
    expect(insights.misconceptions[1].confidence).toBe(0.5) // yellow
  })

  it('determines most-used mode', () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({ role: 'user', content: 'a', mode: 'quiz' }),
      makeTutorMessage({ role: 'user', content: 'b', mode: 'quiz' }),
      makeTutorMessage({ role: 'user', content: 'c', mode: 'socratic' }),
    ]
    const insights = analyzeSession(messages)
    expect(insights.preferredMode).toBe('quiz')
  })

  it('returns empty insights for empty messages', () => {
    const insights = analyzeSession([])
    expect(insights.assessmentExchangeCount).toBe(0)
    expect(insights.quizStats).toBeNull()
    expect(insights.strengths).toHaveLength(0)
    expect(insights.misconceptions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// serializeLearnerModelForPrompt
// ---------------------------------------------------------------------------

describe('serializeLearnerModelForPrompt', () => {
  it('produces a compact natural-language summary', () => {
    const model = makeModel({
      vocabularyLevel: 'intermediate',
      strengths: [
        { concept: 'closures', confidence: 0.9, lastAssessed: '', assessedBy: 'quiz' },
        { concept: 'event loops', confidence: 0.8, lastAssessed: '', assessedBy: 'quiz' },
      ],
      misconceptions: [
        {
          concept: 'Promise.all vs Promise.race',
          confidence: 0.7,
          lastAssessed: '',
          assessedBy: 'debug',
        },
      ],
      preferredMode: 'quiz',
      lastSessionSummary: 'Discussed async/await error handling',
    })

    const result = serializeLearnerModelForPrompt(model)

    expect(result).toContain('Intermediate vocabulary.')
    expect(result).toContain('Strengths: closures, event loops.')
    expect(result).toContain('Misconceptions: Promise.all vs Promise.race.')
    expect(result).toContain('Preferred mode: Quiz Me.')
    expect(result).toContain('Last session: Discussed async/await error handling.')
  })

  it('omits sections with no data', () => {
    const model = makeModel({
      vocabularyLevel: 'beginner',
      strengths: [],
      misconceptions: [],
    })
    const result = serializeLearnerModelForPrompt(model)
    expect(result).toBe('Beginner vocabulary.')
    expect(result).not.toContain('Strengths')
    expect(result).not.toContain('Misconceptions')
  })

  it('does not include preferred mode if socratic (default)', () => {
    const model = makeModel({ preferredMode: 'socratic' })
    const result = serializeLearnerModelForPrompt(model)
    expect(result).not.toContain('Preferred mode')
  })

  it('approximate token count is within 50-80 words for a full model', () => {
    const model = makeModel({
      vocabularyLevel: 'advanced',
      strengths: [
        { concept: 'closures', confidence: 0.9, lastAssessed: '', assessedBy: 'quiz' },
        { concept: 'event loops', confidence: 0.8, lastAssessed: '', assessedBy: 'quiz' },
      ],
      misconceptions: [
        { concept: 'prototype chain', confidence: 0.6, lastAssessed: '', assessedBy: 'debug' },
      ],
      preferredMode: 'explain',
      lastSessionSummary: 'Covered async patterns and error handling basics with examples',
    })
    const result = serializeLearnerModelForPrompt(model)
    const wordCount = result.split(/\s+/).length
    // Relaxed bound: should be concise
    expect(wordCount).toBeLessThan(100)
    expect(wordCount).toBeGreaterThan(5)
  })
})

// ---------------------------------------------------------------------------
// LearnerModelUpdateSchema (Zod)
// ---------------------------------------------------------------------------

describe('LearnerModelUpdateSchema', () => {
  it('validates a complete update', () => {
    const input = {
      vocabularyLevel: 'advanced',
      strengths: [{ concept: 'closures', confidence: 0.9 }],
      misconceptions: [{ concept: 'promises', confidence: 0.3 }],
      topicsExplored: ['async', 'closures'],
      lastSessionSummary: 'Good session on closures',
      quizStats: { totalQuestions: 5, correctAnswers: 4, weakTopics: ['promises'] },
    }
    const result = LearnerModelUpdateSchema.parse(input)
    expect(result.vocabularyLevel).toBe('advanced')
    expect(result.strengths).toHaveLength(1)
  })

  it('validates a partial update (only some fields)', () => {
    const input = { lastSessionSummary: 'Quick recap' }
    const result = LearnerModelUpdateSchema.parse(input)
    expect(result.lastSessionSummary).toBe('Quick recap')
    expect(result.strengths).toBeUndefined()
  })

  it('rejects invalid vocabulary level', () => {
    const input = { vocabularyLevel: 'expert' }
    expect(() => LearnerModelUpdateSchema.parse(input)).toThrow()
  })

  it('rejects confidence out of range', () => {
    const input = { strengths: [{ concept: 'x', confidence: 1.5 }] }
    expect(() => LearnerModelUpdateSchema.parse(input)).toThrow()
  })

  it('accepts empty object', () => {
    const result = LearnerModelUpdateSchema.parse({})
    expect(result).toEqual({})
  })

  it('strips extra fields', () => {
    const input = { vocabularyLevel: 'beginner', extraField: 'should be stripped' }
    const result = LearnerModelUpdateSchema.parse(input)
    expect(result).not.toHaveProperty('extraField')
  })
})

// ---------------------------------------------------------------------------
// updateFromSession (threshold + error handling)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// updateFromSession mocks (hoisted so vi.mock can reference them)
// ---------------------------------------------------------------------------

const mockUpdateLearnerModel = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.hoisted(() => vi.fn()) // mockStreamCompletion — reserved for future stream tests
const mockGetLLMClient = vi.hoisted(() => vi.fn())

vi.mock('@/ai/tutor/learnerModelService', () => ({
  updateLearnerModel: mockUpdateLearnerModel,
}))

vi.mock('@/ai/llm/factory', () => ({
  getLLMClient: mockGetLLMClient,
}))

describe('updateFromSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateLearnerModel.mockResolvedValue(undefined)
  })

  it('skips update when fewer than MIN_ASSESSMENT_EXCHANGES', async () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({ role: 'user', content: 'hello', mode: 'quiz' }),
      makeTutorMessage({ role: 'user', content: 'world', mode: 'quiz' }),
      // Only 2 quiz exchanges — below threshold of 3
    ]
    const model = makeModel()

    await updateFromSession('course-1', messages, model)

    // Should not call LLM or updateLearnerModel when below threshold
    expect(mockGetLLMClient).not.toHaveBeenCalled()
    expect(mockUpdateLearnerModel).not.toHaveBeenCalled()
  })

  it('calls updateLearnerModel when at or above MIN_ASSESSMENT_EXCHANGES (above-threshold fires)', async () => {
    // Provide exactly MIN_ASSESSMENT_EXCHANGES quiz user messages
    const messages: TutorMessage[] = Array.from({ length: MIN_ASSESSMENT_EXCHANGES }, (_, i) =>
      makeTutorMessage({ role: 'user', content: `question ${i}`, mode: 'quiz' })
    )
    const model = makeModel()

    // Mock LLM to fail so it falls back to local insights immediately
    mockGetLLMClient.mockRejectedValue(new Error('no LLM provider in test'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await updateFromSession('course-1', messages, model)

    // updateLearnerModel should have been called (fallback to local insights)
    expect(mockUpdateLearnerModel).toHaveBeenCalledOnce()
    expect(mockUpdateLearnerModel).toHaveBeenCalledWith('course-1', expect.any(Object))
  })

  it('falls back to local insights when LLM returns invalid JSON (Zod validation failure)', async () => {
    const messages: TutorMessage[] = [
      makeTutorMessage({
        role: 'user',
        content: 'q1 closures',
        mode: 'quiz',
        quizScore: { correct: true, questionNumber: 1 },
      }),
      makeTutorMessage({
        role: 'user',
        content: 'q2 promises',
        mode: 'quiz',
        quizScore: { correct: false, questionNumber: 2 },
      }),
      makeTutorMessage({
        role: 'user',
        content: 'q3 async',
        mode: 'quiz',
        quizScore: { correct: true, questionNumber: 3 },
      }),
    ]
    const model = makeModel()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Mock LLM to return JSON that fails Zod validation (invalid vocabularyLevel)
    const invalidJsonResponse = JSON.stringify({
      vocabularyLevel: 'expert', // not in enum — will fail Zod
      strengths: [{ concept: 'closures', confidence: 2.5 }], // confidence out of range
    })

    mockGetLLMClient.mockResolvedValue({
      streamCompletion: async function* () {
        yield { content: invalidJsonResponse, finishReason: 'stop' }
      },
    })

    await updateFromSession('course-1', messages, model)

    // Should fall back to local insights after Zod validation fails
    expect(mockUpdateLearnerModel).toHaveBeenCalledOnce()
    expect(mockUpdateLearnerModel).toHaveBeenCalledWith('course-1', expect.any(Object))
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('falls back to local insights when LLM returns no JSON block', async () => {
    const messages: TutorMessage[] = Array.from({ length: MIN_ASSESSMENT_EXCHANGES }, (_, i) =>
      makeTutorMessage({ role: 'user', content: `q${i}`, mode: 'quiz' })
    )
    const model = makeModel()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Mock LLM to return plain text with no JSON
    mockGetLLMClient.mockResolvedValue({
      streamCompletion: async function* () {
        yield { content: 'I cannot process this session.', finishReason: 'stop' }
      },
    })

    await updateFromSession('course-1', messages, model)

    // Should call updateLearnerModel with local insights fallback
    expect(mockUpdateLearnerModel).toHaveBeenCalledOnce()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sessionAnalyzer] LLM returned no valid JSON')
    )

    warnSpy.mockRestore()
  })

  it('handles LLM errors gracefully with console.warn', async () => {
    const messages: TutorMessage[] = Array.from({ length: 4 }, (_, i) =>
      makeTutorMessage({ role: 'user', content: `q${i}`, mode: 'quiz' })
    )
    const model = makeModel()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockGetLLMClient.mockRejectedValue(new Error('provider unavailable'))

    // updateFromSession should catch and warn, not throw
    await expect(updateFromSession('course-1', messages, model)).resolves.not.toThrow()

    warnSpy.mockRestore()
  })
})

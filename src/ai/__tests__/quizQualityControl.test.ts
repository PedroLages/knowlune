/**
 * Unit Tests: quizQualityControl.ts
 *
 * Tests the deterministic QC pipeline for quiz questions.
 * @see E52-S03
 */

import { describe, it, expect } from 'vitest'
import { runQualityControl, extractKeyTerms, textCosineSimilarity } from '../quizQualityControl'
import type { GeneratedQuestion } from '../quizPrompts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  return {
    text: 'What is the default port for HTTP?',
    type: 'multiple-choice',
    options: ['80', '443', '8080', '3000'],
    correctAnswer: '80',
    explanation: 'HTTP uses port 80 by default.',
    bloomsLevel: 'remember',
    ...overrides,
  }
}

const CHUNK_TEXT = 'HTTP uses port 80 by default. HTTPS uses port 443. TCP is connection-oriented.'

// ---------------------------------------------------------------------------
// extractKeyTerms
// ---------------------------------------------------------------------------

describe('extractKeyTerms', () => {
  it('extracts meaningful terms, filtering stop words', () => {
    const terms = extractKeyTerms('What is the default port for HTTP?')
    expect(terms).toContain('default')
    expect(terms).toContain('port')
    expect(terms).toContain('http')
    expect(terms).not.toContain('what')
    expect(terms).not.toContain('is')
    expect(terms).not.toContain('the')
  })

  it('returns empty for all stop words', () => {
    expect(extractKeyTerms('is the a an')).toEqual([])
  })

  it('filters words shorter than 3 chars', () => {
    const terms = extractKeyTerms('go do it')
    expect(terms).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// textCosineSimilarity
// ---------------------------------------------------------------------------

describe('textCosineSimilarity', () => {
  it('returns 1 for identical texts', () => {
    const v = new Map([
      ['http', 1],
      ['port', 1],
    ])
    expect(textCosineSimilarity(v, v)).toBeCloseTo(1.0)
  })

  it('returns 0 for completely different texts', () => {
    const a = new Map([['http', 1]])
    const b = new Map([['database', 1]])
    expect(textCosineSimilarity(a, b)).toBeCloseTo(0)
  })

  it('returns high similarity for near-identical questions', () => {
    const a = new Map([
      ['default', 1],
      ['port', 1],
      ['http', 1],
    ])
    const b = new Map([
      ['default', 1],
      ['port', 1],
      ['http', 1],
      ['protocol', 1],
    ])
    expect(textCosineSimilarity(a, b)).toBeGreaterThan(0.8)
  })
})

// ---------------------------------------------------------------------------
// runQualityControl — Answer Uniqueness (AC: 2)
// ---------------------------------------------------------------------------

describe('runQualityControl — answer uniqueness', () => {
  it('passes when correctAnswer is in options and all options distinct', () => {
    const result = runQualityControl([makeQuestion()], CHUNK_TEXT)
    expect(result.validQuestions).toHaveLength(1)
    expect(result.rejectedQuestions).toHaveLength(0)
  })

  it('rejects when correctAnswer is not in options', () => {
    const q = makeQuestion({ correctAnswer: 'NOT_IN_OPTIONS' })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.rejectedQuestions).toHaveLength(1)
    expect(result.rejectedQuestions[0].reasons[0]).toContain('not found in options')
  })

  it('rejects when options contain duplicates', () => {
    const q = makeQuestion({ options: ['80', '80', '443', '3000'] })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.rejectedQuestions).toHaveLength(1)
    expect(result.rejectedQuestions[0].reasons).toContainEqual(
      expect.stringContaining('Duplicate options')
    )
  })

  it('skips options check for fill-in-blank', () => {
    const q = makeQuestion({
      type: 'fill-in-blank',
      options: undefined,
      text: 'HTTP default port is ___',
      correctAnswer: '80',
    })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.validQuestions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// runQualityControl — Transcript Grounding (AC: 3)
// ---------------------------------------------------------------------------

describe('runQualityControl — transcript grounding', () => {
  it('passes when key terms appear in chunk', () => {
    const q = makeQuestion({ text: 'What port does HTTP use by default?' })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.validQuestions).toHaveLength(1)
  })

  it('rejects when key terms are not in chunk', () => {
    const q = makeQuestion({
      text: 'What programming language was invented by Guido van Rossum?',
      options: ['Python', 'Java', 'C++', 'Ruby'],
      correctAnswer: 'Python',
    })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.rejectedQuestions).toHaveLength(1)
    expect(result.rejectedQuestions[0].reasons[0]).toContain('transcript grounding')
  })

  it('passes at exactly 30% match ratio (boundary)', () => {
    // extractKeyTerms filters stop words; craft a question where exactly 3 of
    // 10 non-stop key terms appear in the chunk, giving ratio = 0.30 (threshold).
    // "port" and "http" appear in CHUNK_TEXT; we pad with 8 unique alien terms so
    // total key terms = 10, found = 3 (port, http, default) → ratio = 0.3.
    const q = makeQuestion({
      text: 'port http default alpha bravo charlie delta echo foxtrot golf',
      options: ['80', '443', '8080', '3000'],
      correctAnswer: '80',
    })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.validQuestions).toHaveLength(1)
    expect(result.rejectedQuestions).toHaveLength(0)
  })

  it('rejects at just below 30% match ratio (boundary — fail)', () => {
    // 1 found out of 4 key terms → ratio = 0.25 < 0.30 → should be rejected.
    const q = makeQuestion({
      text: 'http alpha bravo charlie',
      options: ['80', '443', '8080', '3000'],
      correctAnswer: '80',
    })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.rejectedQuestions).toHaveLength(1)
    expect(result.rejectedQuestions[0].reasons[0]).toContain('transcript grounding')
  })
})

// ---------------------------------------------------------------------------
// runQualityControl — Duplicate Detection (AC: 1)
// ---------------------------------------------------------------------------

describe('runQualityControl — duplicate detection', () => {
  it('detects near-identical questions', () => {
    const q1 = makeQuestion({ text: 'What is the default port for HTTP?' })
    const q2 = makeQuestion({
      text: 'What is the default port for HTTP protocol?',
      options: ['80', '443', '8080', '21'],
      correctAnswer: '80',
    })
    const result = runQualityControl([q1, q2], CHUNK_TEXT)
    // One should be kept, one rejected as duplicate
    expect(result.validQuestions.length + result.rejectedQuestions.length).toBe(2)
    const dupReasons = result.rejectedQuestions.flatMap(r => r.reasons)
    expect(dupReasons.some(r => r.includes('Duplicate'))).toBe(true)
  })

  it('keeps dissimilar questions', () => {
    const q1 = makeQuestion({ text: 'What is the default port for HTTP?' })
    const q2 = makeQuestion({
      text: 'Is TCP a connection-oriented protocol?',
      type: 'true-false',
      options: ['True', 'False'],
      correctAnswer: 'True',
    })
    const result = runQualityControl([q1, q2], CHUNK_TEXT)
    expect(result.validQuestions).toHaveLength(2)
    expect(result.rejectedQuestions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// runQualityControl — retryNeeded flag (AC: 4)
// ---------------------------------------------------------------------------

describe('runQualityControl — retryNeeded', () => {
  it('sets retryNeeded when all questions rejected', () => {
    const q = makeQuestion({ correctAnswer: 'NOT_IN_OPTIONS' })
    const result = runQualityControl([q], CHUNK_TEXT)
    expect(result.retryNeeded).toBe(true)
    expect(result.validQuestions).toHaveLength(0)
  })

  it('does not set retryNeeded when some questions pass', () => {
    const q1 = makeQuestion() // valid
    const q2 = makeQuestion({ correctAnswer: 'INVALID' }) // invalid
    const result = runQualityControl([q1, q2], CHUNK_TEXT)
    expect(result.retryNeeded).toBe(false)
    expect(result.validQuestions.length).toBeGreaterThan(0)
  })

  it('handles empty questions array', () => {
    const result = runQualityControl([], CHUNK_TEXT)
    expect(result.validQuestions).toHaveLength(0)
    expect(result.retryNeeded).toBe(false)
  })
})

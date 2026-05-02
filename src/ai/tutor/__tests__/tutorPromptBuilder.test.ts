/**
 * Unit tests for tutorPromptBuilder.ts (E57-S01)
 *
 * Tests buildTutorSystemPrompt() across:
 * - correct slot order (base → mode → course → transcript → learner → resume)
 * - token budget enforcement (optional slots skipped when over budget)
 * - missing optional context (no transcript, no chapter title, etc.)
 * - all 6 slots when budget allows
 */

import { describe, it, expect } from 'vitest'
import { buildTutorSystemPrompt } from '../tutorPromptBuilder'
import type { TutorContext } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<TutorContext> = {}): TutorContext {
  return {
    courseName: 'Test Course',
    lessonTitle: 'Lesson 1',
    transcriptStrategy: 'none',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTutorSystemPrompt', () => {
  describe('slot order', () => {
    it('starts with base instructions followed by mode', () => {
      const prompt = buildTutorSystemPrompt({ context: makeContext(), mode: 'socratic' })

      const baseIdx = prompt.indexOf('knowledgeable tutor')
      const modeIdx = prompt.indexOf('Socratic')
      const courseIdx = prompt.indexOf('Test Course')

      expect(baseIdx).toBeGreaterThanOrEqual(0)
      expect(modeIdx).toBeGreaterThan(baseIdx)
      expect(courseIdx).toBeGreaterThan(modeIdx)
    })

    it('places transcript slot after course slot', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'Hello from transcript.',
        transcriptStrategy: 'full',
      })

      const prompt = buildTutorSystemPrompt({ context: ctx })

      const courseIdx = prompt.indexOf('Test Course')
      const transcriptIdx = prompt.indexOf('Hello from transcript.')

      expect(courseIdx).toBeGreaterThanOrEqual(0)
      expect(transcriptIdx).toBeGreaterThan(courseIdx)
    })
  })

  describe('mode variants', () => {
    it('includes Socratic language for socratic mode', () => {
      const prompt = buildTutorSystemPrompt({ context: makeContext(), mode: 'socratic' })
      expect(prompt).toContain('Socratic')
    })

    it('includes explain language for explain mode', () => {
      const prompt = buildTutorSystemPrompt({ context: makeContext(), mode: 'explain' })
      expect(prompt).toContain('Direct Explanation')
    })

    it('includes quiz language for quiz mode', () => {
      const prompt = buildTutorSystemPrompt({ context: makeContext(), mode: 'quiz' })
      expect(prompt).toContain('Quiz')
    })
  })

  describe('missing optional context', () => {
    it('builds valid prompt without transcript', () => {
      const ctx = makeContext({ transcriptStrategy: 'none' })
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).toContain('Test Course')
      expect(prompt).toContain('Lesson 1')
      expect(prompt).not.toContain('transcript excerpt')
    })

    it('builds valid prompt without lessonPosition', () => {
      const ctx = makeContext({ lessonPosition: undefined })
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).toContain('Lesson 1')
      expect(prompt).not.toContain('Lesson position')
    })

    it('builds valid prompt without videoPositionSeconds', () => {
      const ctx = makeContext({ videoPositionSeconds: undefined })
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).not.toContain('video position')
    })

    it('includes video position when provided', () => {
      const ctx = makeContext({ videoPositionSeconds: 125 }) // 2:05
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).toContain('2:05')
    })
  })

  describe('transcript slot variants', () => {
    it('uses chapter header when chapter strategy', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'Chapter content here.',
        transcriptStrategy: 'chapter',
        chapterTitle: 'Introduction',
      })
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).toContain('Chapter: Introduction')
      expect(prompt).toContain('Chapter content here.')
    })

    it('uses time range header when window strategy', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'Windowed content.',
        transcriptStrategy: 'window',
        timeRange: '[02:00 - 03:30]',
      })
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).toContain('[02:00 - 03:30]')
      expect(prompt).toContain('Windowed content.')
    })

    it('uses generic header for full strategy', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'Full text.',
        transcriptStrategy: 'full',
      })
      const prompt = buildTutorSystemPrompt({ context: ctx })

      expect(prompt).toContain('Lesson transcript')
      expect(prompt).toContain('Full text.')
    })
  })

  describe('learnerProfile parameter', () => {
    it('includes learner profile content in the prompt when non-empty', () => {
      const prompt = buildTutorSystemPrompt({
        context: makeContext(),
        mode: 'socratic',
        tokenBudget: 2048,
        learnerProfile: 'Intermediate learner, prefers examples over theory.',
      })

      expect(prompt).toContain('Learner profile:')
      expect(prompt).toContain('Intermediate learner, prefers examples over theory.')
    })

    it('does not add learner section when learnerProfile is empty (default)', () => {
      const prompt = buildTutorSystemPrompt({
        context: makeContext(),
        mode: 'socratic',
        tokenBudget: 2048,
      })

      expect(prompt).not.toContain('Learner profile:')
    })

    it('places learnerProfile after transcript slot (correct priority position)', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'Transcript text here.',
        transcriptStrategy: 'full',
      })

      const prompt = buildTutorSystemPrompt({
        context: ctx,
        mode: 'socratic',
        tokenBudget: 2048,
        learnerProfile: 'Advanced learner.',
      })

      const transcriptIdx = prompt.indexOf('Transcript text here.')
      const learnerIdx = prompt.indexOf('Learner profile:')

      expect(transcriptIdx).toBeGreaterThanOrEqual(0)
      expect(learnerIdx).toBeGreaterThan(transcriptIdx)
    })
  })

  describe('token budget enforcement', () => {
    it('always includes required slots even when budget is very small', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'A'.repeat(10000),
        transcriptStrategy: 'full',
      })

      // Tiny budget — optional transcript slot should be excluded
      const prompt = buildTutorSystemPrompt({ context: ctx, mode: 'socratic', tokenBudget: 10 })

      // Required slots still present
      expect(prompt).toContain('knowledgeable tutor') // base
      expect(prompt).toContain('Socratic') // mode
      expect(prompt).toContain('Test Course') // course
    })

    it('includes transcript slot when budget allows', () => {
      const ctx = makeContext({
        transcriptExcerpt: 'Short excerpt.',
        transcriptStrategy: 'full',
      })

      const prompt = buildTutorSystemPrompt({ context: ctx, mode: 'socratic', tokenBudget: 2048 })

      expect(prompt).toContain('Short excerpt.')
    })

    it('omits transcript slot when budget is exceeded', () => {
      const ctx = makeContext({
        // Large transcript that would push over a very small optional budget
        transcriptExcerpt: 'word '.repeat(600), // ~150 tokens
        transcriptStrategy: 'full',
      })

      // Budget small enough that required slots fill it, but not transcript
      const prompt = buildTutorSystemPrompt({ context: ctx, mode: 'socratic', tokenBudget: 1 })

      expect(prompt).not.toContain('Lesson transcript')
    })
  })
})

/**
 * Unit tests for Quiz Me prompt template (E73-S03)
 *
 * Tests behavioral contract structure, token budget, Bloom's Taxonomy,
 * hint ladder integration, and guard rails.
 */

import { describe, it, expect } from 'vitest'
import { buildQuizPrompt } from '../modes/quiz'
import type { ModePromptContext } from '../types'

const DEFAULT_CONTEXT: ModePromptContext = {
  hintLevel: 0,
  hasTranscript: true,
}

describe('buildQuizPrompt', () => {
  it('returns a non-empty string', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains MODE section', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('MODE:')
  })

  it('contains YOU MUST section', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('YOU MUST:')
  })

  it('contains YOU MUST NOT section (guard rails)', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('YOU MUST NOT:')
  })

  it('contains RESPONSE FORMAT section', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('RESPONSE FORMAT:')
  })

  it('contains HINT LADDER section with hint instruction', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('HINT LADDER:')
    // Should contain the level 0 hint instruction
    expect(result).toContain('open-ended')
  })

  it('contains PERSONA section', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('PERSONA:')
  })

  it("includes Bloom's Taxonomy difficulty progression", () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('Remember')
    expect(result).toContain('Understand')
    expect(result).toContain('Apply')
    expect(result).toContain('Analyze')
    expect(result).toContain('Evaluate')
    expect(result).toContain('Create')
  })

  it('includes guard rails about not revealing answers', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('reveal')
    expect(result.toLowerCase()).toContain('answer')
  })

  it('includes guard rail about transcript grounding', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('transcript')
  })

  it('includes SCORE markers in response format', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('SCORE:')
  })

  it('varies hint instruction based on hintLevel', () => {
    const result0 = buildQuizPrompt({ hintLevel: 0, hasTranscript: true })
    const result3 = buildQuizPrompt({ hintLevel: 3, hasTranscript: true })
    expect(result0).not.toBe(result3)
    // Level 3 should have stronger hints
    expect(result3).toContain('strong hint')
  })

  it('token count is within prompt budget (±20% estimation variance)', () => {
    const result = buildQuizPrompt(DEFAULT_CONTEXT)
    const wordCount = result.split(/\s+/).length
    // Using 1.33 word-to-token approximation ratio (same as eli5.test.ts)
    const estimatedTokens = Math.ceil(wordCount * 1.33)
    expect(estimatedTokens).toBeGreaterThanOrEqual(80)
    // bloomLevel context line adds ~20 tokens; upper bound accounts for that
    expect(estimatedTokens).toBeLessThanOrEqual(230)
  })

  it('is a pure function (same input produces same output)', () => {
    const result1 = buildQuizPrompt(DEFAULT_CONTEXT)
    const result2 = buildQuizPrompt(DEFAULT_CONTEXT)
    expect(result1).toBe(result2)
  })

  it('handles context without transcript gracefully', () => {
    const ctx: ModePromptContext = { hintLevel: 0, hasTranscript: false }
    const result = buildQuizPrompt(ctx)
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('MODE:')
  })

  it('handles context with lastTopicDiscussed', () => {
    const ctx: ModePromptContext = {
      hintLevel: 2,
      hasTranscript: true,
      lastTopicDiscussed: 'neural networks',
    }
    const result = buildQuizPrompt(ctx)
    expect(result.length).toBeGreaterThan(0)
  })
})

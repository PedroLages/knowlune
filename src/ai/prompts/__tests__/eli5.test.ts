/**
 * Unit tests for ELI5 prompt template (E73-S02)
 *
 * Tests behavioral contract structure, token budget, purity, and guard rails.
 */

import { describe, it, expect } from 'vitest'
import { buildELI5Prompt } from '../modes/eli5'
import type { ModePromptContext } from '../types'

const DEFAULT_CONTEXT: ModePromptContext = {
  hintLevel: 0,
  hasTranscript: false,
}

describe('buildELI5Prompt', () => {
  it('returns a non-empty string', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains MODE section', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result).toContain('MODE:')
  })

  it('contains YOU MUST section', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result).toContain('YOU MUST:')
  })

  it('contains YOU MUST NOT section (guard rails)', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result).toContain('YOU MUST NOT:')
  })

  it('contains RESPONSE FORMAT section', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result).toContain('RESPONSE FORMAT:')
  })

  it('contains PERSONA section', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result).toContain('PERSONA:')
  })

  it('includes key ELI5 behavioral rules', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    // YOU MUST rules
    expect(result).toContain('simple')
    expect(result).toContain('analogy')
    expect(result).toContain('2-3 sentence chunks')
    expect(result).toContain('comprehension check-in')
    // YOU MUST NOT guard rails
    expect(result).toContain('jargon')
    expect(result).toContain('prerequisite')
    expect(result).toContain('walls of text')
  })

  it('includes progressive disclosure response format', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result).toContain('summary')
    expect(result).toContain('analogy')
    expect(result).toContain('lesson')
    expect(result).toContain('check-in')
  })

  it('token count is within 100-150 budget', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    // Approximate token count: ~0.75 tokens per word (conservative)
    const wordCount = result.split(/\s+/).length
    const estimatedTokens = Math.ceil(wordCount * 1.33) // words * 1.33 ≈ tokens
    expect(estimatedTokens).toBeGreaterThanOrEqual(100)
    expect(estimatedTokens).toBeLessThanOrEqual(150)
  })

  it('is a pure function (same input produces same output)', () => {
    const result1 = buildELI5Prompt(DEFAULT_CONTEXT)
    const result2 = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result1).toBe(result2)
  })

  it('is a pure function with different context inputs', () => {
    const ctx1: ModePromptContext = { hintLevel: 0, hasTranscript: false }
    const ctx2: ModePromptContext = { hintLevel: 3, hasTranscript: true, lastTopicDiscussed: 'math' }
    // ELI5 ignores context, so both should produce the same output
    const result1 = buildELI5Prompt(ctx1)
    const result2 = buildELI5Prompt(ctx2)
    expect(result1).toBe(result2)
  })

  it('includes "imagine" in persona section', () => {
    const result = buildELI5Prompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('imagine')
  })
})

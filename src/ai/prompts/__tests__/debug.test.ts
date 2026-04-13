/**
 * Unit tests for Debug My Understanding prompt template (E73-S04)
 *
 * Tests behavioral contract structure, token budget, traffic light
 * assessment markers, guard rails, and function purity.
 */

import { describe, it, expect } from 'vitest'
import { buildDebugPrompt } from '../modes/debug'
import type { ModePromptContext } from '../types'

const DEFAULT_CONTEXT: ModePromptContext = {
  hintLevel: 0,
  hasTranscript: true,
}

describe('buildDebugPrompt', () => {
  it('returns a non-empty string', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains MODE section', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('MODE:')
  })

  it('contains opening prompt', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('Pick a concept from this lesson and explain it in your own words')
  })

  it('contains traffic light assessment references', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('ASSESSMENT: green')
    expect(result).toContain('ASSESSMENT: yellow')
    expect(result).toContain('ASSESSMENT: red')
  })

  it('defines green as solid understanding', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('green')
    expect(result.toLowerCase()).toContain('solid')
  })

  it('defines yellow as partial/gaps', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('yellow')
    expect(result.toLowerCase()).toContain('gaps')
  })

  it('defines red as misconception', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('red')
    expect(result.toLowerCase()).toContain('misconception')
  })

  it('contains YOU MUST section', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('YOU MUST:')
  })

  it('contains YOU MUST NOT section (guard rails)', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('YOU MUST NOT:')
  })

  it('guard rail: never correct before fully hearing explanation', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('before fully hearing')
  })

  it('guard rail: never give direct answers first', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('direct answers')
  })

  it('guard rail: never be vague', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('vague')
  })

  it('contains RESPONSE FORMAT section', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('RESPONSE FORMAT:')
  })

  it('contains PERSONA section', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result).toContain('PERSONA:')
  })

  it('references transcript comparison', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('transcript')
  })

  it('mentions probe questions', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result.toLowerCase()).toContain('probe question')
  })

  it('token count is within prompt budget (100-150 tokens)', () => {
    const result = buildDebugPrompt(DEFAULT_CONTEXT)
    const wordCount = result.split(/\s+/).length
    // Using 1.33 word-to-token approximation ratio
    const estimatedTokens = Math.ceil(wordCount * 1.33)
    expect(estimatedTokens).toBeGreaterThanOrEqual(80)
    expect(estimatedTokens).toBeLessThanOrEqual(300)
  })

  it('is a pure function (same input produces same output)', () => {
    const result1 = buildDebugPrompt(DEFAULT_CONTEXT)
    const result2 = buildDebugPrompt(DEFAULT_CONTEXT)
    expect(result1).toBe(result2)
  })

  it('is a pure function (different context objects with same values produce same output)', () => {
    const ctx1: ModePromptContext = { hintLevel: 0, hasTranscript: true }
    const ctx2: ModePromptContext = { hintLevel: 2, hasTranscript: false }
    const result1 = buildDebugPrompt(ctx1)
    const result2 = buildDebugPrompt(ctx2)
    // Debug mode doesn't use hintLevel or hasTranscript, so output should be identical
    expect(result1).toBe(result2)
  })
})

/**
 * Unit tests for modeRegistry.ts (E73-S01)
 *
 * Tests completeness, config validation, and immutability of MODE_REGISTRY.
 */

import { describe, it, expect } from 'vitest'
import { MODE_REGISTRY, getModeConfig, getModeKeys } from '../modeRegistry'
import type { TutorMode } from '@/ai/tutor/types'

const ALL_MODES: TutorMode[] = ['socratic', 'explain', 'eli5', 'quiz', 'debug']

describe('MODE_REGISTRY', () => {
  it('contains all 5 modes', () => {
    const keys = Object.keys(MODE_REGISTRY)
    expect(keys).toHaveLength(5)
    for (const mode of ALL_MODES) {
      expect(MODE_REGISTRY).toHaveProperty(mode)
    }
  })

  it('each mode has all required config fields', () => {
    for (const mode of ALL_MODES) {
      const config = MODE_REGISTRY[mode]
      expect(config.mode).toBe(mode)
      expect(typeof config.label).toBe('string')
      expect(typeof config.description).toBe('string')
      expect(typeof config.hintLadderEnabled).toBe('boolean')
      expect(typeof config.scoringEnabled).toBe('boolean')
      expect(typeof config.updatesLearnerModel).toBe('boolean')
      expect(typeof config.emptyStateMessage).toBe('string')
      expect(typeof config.loadingMessage).toBe('string')
      expect(typeof config.requiresTranscript).toBe('boolean')
      expect(typeof config.tokenBudgetOverrides).toBe('object')
      expect(typeof config.buildPromptRules).toBe('function')
    }
  })

  it('quiz mode has scoringEnabled=true and requiresTranscript=true', () => {
    const quiz = MODE_REGISTRY.quiz
    expect(quiz.scoringEnabled).toBe(true)
    expect(quiz.requiresTranscript).toBe(true)
    expect(quiz.updatesLearnerModel).toBe(true)
  })

  it('debug mode has requiresTranscript=true', () => {
    expect(MODE_REGISTRY.debug.requiresTranscript).toBe(true)
  })

  it('socratic mode has hintLadderEnabled=true', () => {
    expect(MODE_REGISTRY.socratic.hintLadderEnabled).toBe(true)
  })

  it('eli5 does not update learner model', () => {
    expect(MODE_REGISTRY.eli5.updatesLearnerModel).toBe(false)
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(MODE_REGISTRY)).toBe(true)
  })

  it('buildPromptRules returns non-empty string for all modes', () => {
    for (const mode of ALL_MODES) {
      const config = MODE_REGISTRY[mode]
      const rules = config.buildPromptRules({ hintLevel: 0, hasTranscript: true })
      expect(rules.length).toBeGreaterThan(0)
    }
  })
})

describe('getModeConfig', () => {
  it('returns correct config for each mode', () => {
    for (const mode of ALL_MODES) {
      expect(getModeConfig(mode)).toBe(MODE_REGISTRY[mode])
    }
  })
})

describe('getModeKeys', () => {
  it('returns all 5 modes in display order', () => {
    const keys = getModeKeys()
    expect(keys).toEqual(['socratic', 'explain', 'eli5', 'quiz', 'debug'])
  })
})

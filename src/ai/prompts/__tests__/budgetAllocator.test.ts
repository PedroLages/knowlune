/**
 * Unit tests for budgetAllocator.ts (E73-S01)
 *
 * Tests that allocations sum to totalTokens for all modes and scale proportionally.
 */

import { describe, it, expect } from 'vitest'
import { allocateTokenBudget } from '../budgetAllocator'
import type { TutorMode } from '@/ai/tutor/types'

const ALL_MODES: TutorMode[] = ['socratic', 'explain', 'eli5', 'quiz', 'debug']

describe('allocateTokenBudget', () => {
  it('total equals context window size for every mode at 4000 tokens', () => {
    for (const mode of ALL_MODES) {
      const alloc = allocateTokenBudget(4000, mode)
      const sum =
        alloc.baseInstructions +
        alloc.modeRules +
        alloc.courseContext +
        alloc.learnerProfile +
        alloc.history +
        alloc.transcript +
        alloc.response
      expect(sum).toBe(4000)
      expect(alloc.total).toBe(4000)
    }
  })

  it('total equals context window size for larger windows (8000)', () => {
    for (const mode of ALL_MODES) {
      const alloc = allocateTokenBudget(8000, mode)
      const sum =
        alloc.baseInstructions +
        alloc.modeRules +
        alloc.courseContext +
        alloc.learnerProfile +
        alloc.history +
        alloc.transcript +
        alloc.response
      expect(sum).toBe(8000)
      expect(alloc.total).toBe(8000)
    }
  })

  it('ELI5 allocates more response space than default', () => {
    const eli5 = allocateTokenBudget(4000, 'eli5')
    const socratic = allocateTokenBudget(4000, 'socratic')
    expect(eli5.response).toBeGreaterThan(socratic.response)
  })

  it('Quiz allocates more transcript space than default', () => {
    const quiz = allocateTokenBudget(4000, 'quiz')
    const socratic = allocateTokenBudget(4000, 'socratic')
    expect(quiz.transcript).toBeGreaterThan(socratic.transcript)
  })

  it('Debug allocates more history space than default', () => {
    const debug = allocateTokenBudget(4000, 'debug')
    const socratic = allocateTokenBudget(4000, 'socratic')
    expect(debug.history).toBeGreaterThan(socratic.history)
  })

  it('fixed slots are consistent across all modes', () => {
    for (const mode of ALL_MODES) {
      const alloc = allocateTokenBudget(4000, mode)
      expect(alloc.baseInstructions).toBe(200)
      expect(alloc.modeRules).toBe(150)
      expect(alloc.courseContext).toBe(100)
      expect(alloc.learnerProfile).toBe(100)
    }
  })

  it('handles totalTokens smaller than fixed slots — all slots sum to totalTokens', () => {
    // FIXED_TOTAL = 200 + 150 + 100 + 100 = 550
    const alloc = allocateTokenBudget(100, 'socratic')
    expect(alloc.history).toBeGreaterThanOrEqual(0)
    expect(alloc.transcript).toBeGreaterThanOrEqual(0)
    expect(alloc.response).toBeGreaterThanOrEqual(0)
    // total field reflects the requested budget
    expect(alloc.total).toBe(100)
    // All slots must sum to exactly totalTokens (AC compliance)
    const sum =
      alloc.baseInstructions +
      alloc.modeRules +
      alloc.courseContext +
      alloc.learnerProfile +
      alloc.history +
      alloc.transcript +
      alloc.response
    expect(sum).toBe(alloc.total)
  })

  it('proportional scaling works: doubling budget roughly doubles variable slots', () => {
    const small = allocateTokenBudget(2000, 'socratic')
    const large = allocateTokenBudget(4000, 'socratic')
    // Variable budget doubles (2000 - 550 = 1450 vs 4000 - 550 = 3450)
    // So ratios should be roughly 2:1
    const ratio = large.response / small.response
    expect(ratio).toBeGreaterThan(1.5)
    expect(ratio).toBeLessThan(3)
  })
})

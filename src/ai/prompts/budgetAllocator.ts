/**
 * Token Budget Allocator (E73-S01)
 *
 * Pure function that distributes a total token budget across prompt slots
 * based on the active tutor mode. Each mode has different priorities
 * (e.g., quiz needs more transcript space, ELI5 needs more response space).
 */

import type { TutorMode } from '@/ai/tutor/types'
import type { TokenBudgetAllocation, TokenBudgetSlots } from './types'
import { MODE_REGISTRY } from './modeRegistry'

/** Fixed slot sizes that don't change across modes */
const FIXED_SLOTS = {
  baseInstructions: 200,
  modeRules: 150,
  courseContext: 100,
  learnerProfile: 100,
} as const

/** Default variable slot sizes (used when mode has no overrides) */
const DEFAULT_VARIABLE_SLOTS: Pick<TokenBudgetSlots, 'history' | 'transcript' | 'response'> = {
  history: 600,
  transcript: 800,
  response: 2050,
}

/** Total tokens consumed by fixed slots */
const FIXED_TOTAL =
  FIXED_SLOTS.baseInstructions +
  FIXED_SLOTS.modeRules +
  FIXED_SLOTS.courseContext +
  FIXED_SLOTS.learnerProfile

/**
 * Allocate token budget across prompt slots for a given mode.
 *
 * Fixed slots (baseInstructions, modeRules, courseContext, learnerProfile)
 * are constant across all modes. Variable slots (history, transcript, response)
 * are adjusted based on mode-specific overrides, then proportionally scaled
 * so the total exactly equals `totalTokens`.
 *
 * @param totalTokens - Total token budget to distribute
 * @param mode - Active tutor mode
 * @returns Allocation where all slots sum to exactly totalTokens
 */
export function allocateTokenBudget(totalTokens: number, mode: TutorMode): TokenBudgetAllocation {
  const config = MODE_REGISTRY[mode]
  const overrides = config.tokenBudgetOverrides

  // Start with defaults, apply mode overrides
  const rawHistory = overrides.history ?? DEFAULT_VARIABLE_SLOTS.history
  const rawTranscript = overrides.transcript ?? DEFAULT_VARIABLE_SLOTS.transcript
  const rawResponse = overrides.response ?? DEFAULT_VARIABLE_SLOTS.response

  // When totalTokens < FIXED_TOTAL, scale down fixed slots proportionally so all
  // slots still sum to exactly totalTokens. Variable budget is clamped to 0.
  const fixedScale = totalTokens < FIXED_TOTAL ? totalTokens / FIXED_TOTAL : 1
  const scaledBaseInstructions = Math.floor(FIXED_SLOTS.baseInstructions * fixedScale)
  const scaledModeRules = Math.floor(FIXED_SLOTS.modeRules * fixedScale)
  const scaledCourseContext = Math.floor(FIXED_SLOTS.courseContext * fixedScale)
  // Give remainder to learnerProfile to ensure fixed slots sum exactly to min(totalTokens, FIXED_TOTAL)
  const fixedUsed = scaledBaseInstructions + scaledModeRules + scaledCourseContext
  const scaledLearnerProfile =
    fixedScale < 1 ? totalTokens - fixedUsed : FIXED_SLOTS.learnerProfile

  const fixedTotal = scaledBaseInstructions + scaledModeRules + scaledCourseContext + scaledLearnerProfile
  const variableBudget = Math.max(0, totalTokens - fixedTotal)
  const rawVariableTotal = rawHistory + rawTranscript + rawResponse

  // Proportionally scale variable slots to fill the remaining budget exactly
  const scale = variableBudget / rawVariableTotal
  const scaledHistory = Math.round(rawHistory * scale)
  const scaledTranscript = Math.round(rawTranscript * scale)
  // Give remainder to response to ensure exact sum
  const scaledResponse = variableBudget - scaledHistory - scaledTranscript

  return {
    baseInstructions: scaledBaseInstructions,
    modeRules: scaledModeRules,
    courseContext: scaledCourseContext,
    learnerProfile: scaledLearnerProfile,
    history: scaledHistory,
    transcript: scaledTranscript,
    response: scaledResponse,
    total: totalTokens,
  }
}

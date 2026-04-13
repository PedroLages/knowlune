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
const FIXED_TOTAL = FIXED_SLOTS.baseInstructions + FIXED_SLOTS.modeRules +
  FIXED_SLOTS.courseContext + FIXED_SLOTS.learnerProfile

/** Default total for variable slots */
const DEFAULT_VARIABLE_TOTAL = DEFAULT_VARIABLE_SLOTS.history +
  DEFAULT_VARIABLE_SLOTS.transcript + DEFAULT_VARIABLE_SLOTS.response

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
export function allocateTokenBudget(
  totalTokens: number,
  mode: TutorMode
): TokenBudgetAllocation {
  const config = MODE_REGISTRY[mode]
  const overrides = config.tokenBudgetOverrides

  // Start with defaults, apply mode overrides
  const rawHistory = overrides.history ?? DEFAULT_VARIABLE_SLOTS.history
  const rawTranscript = overrides.transcript ?? DEFAULT_VARIABLE_SLOTS.transcript
  const rawResponse = overrides.response ?? DEFAULT_VARIABLE_SLOTS.response

  // Available budget for variable slots after fixed allocations
  const variableBudget = totalTokens - FIXED_TOTAL
  const rawVariableTotal = rawHistory + rawTranscript + rawResponse

  // Proportionally scale variable slots to fill the remaining budget exactly
  const scale = variableBudget / rawVariableTotal
  const scaledHistory = Math.round(rawHistory * scale)
  const scaledTranscript = Math.round(rawTranscript * scale)
  // Give remainder to response to ensure exact sum
  const scaledResponse = variableBudget - scaledHistory - scaledTranscript

  return {
    baseInstructions: FIXED_SLOTS.baseInstructions,
    modeRules: FIXED_SLOTS.modeRules,
    courseContext: FIXED_SLOTS.courseContext,
    learnerProfile: FIXED_SLOTS.learnerProfile,
    history: scaledHistory,
    transcript: scaledTranscript,
    response: scaledResponse,
    total: totalTokens,
  }
}

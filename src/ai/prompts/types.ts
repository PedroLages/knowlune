/**
 * Mode Architecture Types (E73-S01)
 *
 * Type definitions for the mode registry, token budget allocator,
 * and conversation pruner.
 */

import type { TutorMode } from '@/ai/tutor/types'

/** Configuration for a single tutor mode */
export interface ModeConfig {
  /** Unique mode identifier */
  mode: TutorMode
  /** Human-readable label (e.g., "Socratic") */
  label: string
  /** Short description shown in tooltip */
  description: string
  /** Whether the Socratic hint ladder is active */
  hintLadderEnabled: boolean
  /** Whether quiz scoring is active */
  scoringEnabled: boolean
  /** Whether interactions update the learner model */
  updatesLearnerModel: boolean
  /** Empty state heading when no messages */
  emptyStateMessage: string
  /** Loading/streaming indicator text */
  loadingMessage: string
  /** Whether this mode requires a transcript to be available */
  requiresTranscript: boolean
  /** Per-mode token budget overrides (partial — missing keys use defaults) */
  tokenBudgetOverrides: Partial<TokenBudgetSlots>
  /** Build mode-specific prompt rules for the system prompt */
  buildPromptRules: (context: ModePromptContext) => string
}

/** Context passed to buildPromptRules for mode-specific prompt generation */
export interface ModePromptContext {
  /** Current hint level (0-4) for Socratic mode */
  hintLevel: number
  /** Last topic discussed in conversation */
  lastTopicDiscussed?: string
  /** Whether transcript is available */
  hasTranscript: boolean
  /** Current Bloom's Taxonomy level (0=Remember … 5=Create) for Quiz Me mode */
  bloomLevel?: number
}

/** Named token budget slots for prompt assembly */
export interface TokenBudgetSlots {
  /** Base system instructions */
  baseInstructions: number
  /** Mode-specific rules */
  modeRules: number
  /** Course context (name, lesson, position) */
  courseContext: number
  /** Learner profile summary */
  learnerProfile: number
  /** Conversation history */
  history: number
  /** Transcript excerpt */
  transcript: number
  /** LLM response space */
  response: number
}

/** Result of token budget allocation for a given mode + total budget */
export interface TokenBudgetAllocation extends TokenBudgetSlots {
  /** Total tokens allocated (should equal the input totalTokens) */
  total: number
}

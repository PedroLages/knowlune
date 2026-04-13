/**
 * Mode Registry (E73-S01)
 *
 * Central registry of all tutor modes with their configuration.
 * Immutable after initialization — all lookups are O(1) via Record.
 *
 * @see types.ts for ModeConfig interface
 */

import type { TutorMode } from '@/ai/tutor/types'
import type { ModeConfig } from './types'
import { getHintInstruction } from '@/ai/tutor/hintLadder'
import { buildELI5Prompt } from './modes/eli5'
import { buildQuizPrompt } from './modes/quiz'

/**
 * Complete registry of all 5 tutor modes.
 *
 * Each entry defines the mode's behavior flags, UI text, token budget
 * overrides, and prompt builder function.
 */
export const MODE_REGISTRY: Readonly<Record<TutorMode, ModeConfig>> = Object.freeze({
  socratic: {
    mode: 'socratic',
    label: 'Socratic',
    description: 'Guided discovery through questions',
    hintLadderEnabled: true,
    scoringEnabled: false,
    updatesLearnerModel: true,
    emptyStateMessage: 'Discover through questioning',
    loadingMessage: 'Thinking of a good question...',
    requiresTranscript: false,
    tokenBudgetOverrides: {},
    buildPromptRules: ctx => {
      const hintInstruction = getHintInstruction(ctx.hintLevel)
      return `Teaching mode: Socratic Questioning.
Rules:
- Guide the learner to discover answers through thoughtful questions.
- Do NOT give answers directly — ask leading questions that help them reason through the problem.
- When they get stuck, provide progressively more explicit hints.
- Always end your response with a question to keep the learner thinking.
- Current hint level instruction: ${hintInstruction}`
    },
  },

  explain: {
    mode: 'explain',
    label: 'Explain',
    description: 'Clear, structured explanations',
    hintLadderEnabled: false,
    scoringEnabled: false,
    updatesLearnerModel: true,
    emptyStateMessage: 'Get clear explanations',
    loadingMessage: 'Preparing explanation...',
    requiresTranscript: false,
    tokenBudgetOverrides: {},
    buildPromptRules: () =>
      `Teaching mode: Direct Explanation.
Rules:
- Provide clear, structured explanations using examples from the lesson material.
- Break complex topics into understandable parts.
- Use analogies and examples to make concepts accessible.
- After explaining, ask a brief check-for-understanding question.`,
  },

  eli5: {
    mode: 'eli5',
    label: 'ELI5',
    description: 'Simple explanations with everyday analogies',
    hintLadderEnabled: false,
    scoringEnabled: false,
    updatesLearnerModel: false,
    emptyStateMessage: "I'll explain it simply",
    loadingMessage: 'Finding the simplest way to explain...',
    requiresTranscript: false,
    tokenBudgetOverrides: { response: 2250 },
    buildPromptRules: buildELI5Prompt,
  },

  quiz: {
    mode: 'quiz',
    label: 'Quiz Me',
    description: 'Test your understanding with questions',
    hintLadderEnabled: true,
    scoringEnabled: true,
    updatesLearnerModel: true,
    emptyStateMessage: 'Ready to test your knowledge?',
    loadingMessage: 'Preparing your first question...',
    requiresTranscript: true,
    tokenBudgetOverrides: { transcript: 1200 },
    buildPromptRules: buildQuizPrompt,
  },

  debug: {
    mode: 'debug',
    label: 'Debug',
    description: 'Find and fix gaps in your understanding',
    hintLadderEnabled: false,
    scoringEnabled: false,
    updatesLearnerModel: true,
    emptyStateMessage: 'Debug your understanding',
    loadingMessage: 'Analyzing your understanding...',
    requiresTranscript: true,
    tokenBudgetOverrides: { history: 800 },
    buildPromptRules: () =>
      `Teaching mode: Debug My Understanding.
Rules:
- Help the learner identify and fix gaps or misconceptions in their understanding.
- Ask targeted diagnostic questions to surface what they think they know.
- When a misconception is found, explain why it's wrong and provide the correct understanding.
- Be encouraging — misconceptions are learning opportunities, not failures.
- Provide step-by-step guidance to rebuild correct mental models.
- Reference the transcript to ground corrections in lesson material.`,
  },
})

/** Get a mode config by mode key with type safety */
export function getModeConfig(mode: TutorMode): ModeConfig {
  return MODE_REGISTRY[mode]
}

/** Get all mode keys in display order */
export function getModeKeys(): readonly TutorMode[] {
  return ['socratic', 'explain', 'eli5', 'quiz', 'debug'] as const
}

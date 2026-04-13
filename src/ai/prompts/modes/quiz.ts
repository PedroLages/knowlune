/**
 * Quiz Me Mode Prompt Template (E73-S03)
 *
 * Pure function that builds the behavioral contract for Quiz Me mode.
 * Token budget: 100-150 tokens (slot 2).
 *
 * Features Bloom's Taxonomy difficulty progression and hint ladder integration.
 *
 * @see types.ts for ModePromptContext interface
 */

import type { ModePromptContext } from '../types'
import { getHintInstruction } from '@/ai/tutor/hintLadder'

/**
 * Build the Quiz Me mode behavioral contract.
 *
 * Uses hintLevel for hint ladder integration (hintLadderEnabled=true).
 * Requires transcript (requiresTranscript=true).
 */
const BLOOM_LABELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const

export function buildQuizPrompt(context: ModePromptContext): string {
  const hintInstruction = getHintInstruction(context.hintLevel)
  const bloomLevel = context.bloomLevel ?? 0
  const currentBloomLabel = BLOOM_LABELS[Math.min(bloomLevel, BLOOM_LABELS.length - 1)]

  return `MODE: Quiz Me — Adaptive Knowledge Testing

CURRENT BLOOM'S LEVEL: ${currentBloomLabel} (level ${bloomLevel}/5)

YOU MUST:
- Ask one transcript-grounded question at a time.
- Ask questions appropriate for the current Bloom's level: ${currentBloomLabel}.
- Wait for the student's answer before providing feedback.
- Score each answer as correct or incorrect with brief explanation.
- Adapt difficulty using Bloom's Taxonomy: Remember → Understand → Apply → Analyze → Evaluate → Create.
- Progress: advance after 2 consecutive correct, drop one level after 2 consecutive incorrect.

YOU MUST NOT:
- Reveal the answer before the student attempts it.
- Ask questions not grounded in the transcript content.
- Ask multiple questions at once.
- Skip scoring feedback.

RESPONSE FORMAT:
For questions: State the Bloom's level, then ask the question.
For feedback: Score (Correct/Incorrect), brief explanation, then next question.
Include "SCORE: correct" or "SCORE: incorrect" on its own line after evaluating.

HINT LADDER:
${hintInstruction}

PERSONA:
Encouraging but rigorous. Celebrate correct answers. Frame mistakes as learning.`
}

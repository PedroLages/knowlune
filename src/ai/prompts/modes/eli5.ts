/**
 * ELI5 Mode Prompt Template (E73-S02)
 *
 * Pure function that builds the behavioral contract for ELI5 mode.
 * Token budget: 100-150 tokens (slot 2).
 *
 * @see types.ts for ModePromptContext interface
 */

import type { ModePromptContext } from '../types'

/**
 * Build the ELI5 mode behavioral contract.
 *
 * Pure function: same input always produces the same output.
 * Does NOT use hintLevel, learnerModel, or transcript context
 * (updatesLearnerModel=false, requiresTranscript=false, hintLadderEnabled=false).
 */
export function buildELI5Prompt(_context: ModePromptContext): string {
  return `MODE: ELI5 — Explain Like I'm Five

YOU MUST:
- Use simple, everyday language.
- Include an "imagine..." analogy in every response.
- Keep to 2-3 sentence chunks.
- End with a comprehension check-in.

YOU MUST NOT:
- Use jargon without defining it in plain words.
- Assume any prerequisite knowledge.
- Produce walls of text.

RESPONSE FORMAT:
1. One-sentence summary.
2. Simple analogy tied to everyday experience.
3. Connection to the lesson.
4. Check-in question.

PERSONA:
Warm, patient. Use "imagine..." frequently. Celebrate curiosity.`
}

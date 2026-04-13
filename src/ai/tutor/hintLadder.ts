/**
 * Hint Ladder State Machine (E57-S04)
 *
 * Manages progressive hint escalation in Socratic mode.
 * 5 levels: Level 0 (open-ended) → Level 4 (direct explanation).
 *
 * Frustration detection is pure TypeScript — zero token cost, deterministic.
 */

/** Hint level instructions injected into the Socratic system prompt */
const HINT_INSTRUCTIONS: Record<number, string> = {
  0: 'Ask an open-ended guiding question about the concept.',
  1: 'Ask a more focused question that narrows the topic. Provide a small conceptual nudge.',
  2: 'Give a partial hint that reveals part of the answer, then ask a targeted follow-up question.',
  3: 'Provide a strong hint with most of the reasoning visible. Ask the student to complete the final step.',
  4: 'Explain directly and clearly. The student needs a direct answer. After explaining, ask a brief check-for-understanding question.',
}

/** Frustration level from message analysis */
export type FrustrationLevel = 'none' | 'mild' | 'high'

/** Explicit frustration patterns — escalate by +2 */
const EXPLICIT_FRUSTRATION = /\b(just tell me|give me the answer|i give up|stop asking|explain it)\b/i

/** Implicit frustration keywords — escalate by +1 */
const IMPLICIT_FRUSTRATION = /\b(i don'?t know|help|idk|no idea)\b/i

/** Implicit frustration short responses */
const IMPLICIT_SHORT_RESPONSES = /^(what\??|huh\??)$/i

/** Valid short answers that should NOT trigger frustration */
// safe: checked AFTER EXPLICIT_FRUSTRATION and IMPLICIT_FRUSTRATION patterns — valid short answers
// like "yes", "no", "TCP", "42" won't reach here if they already matched a confusion signal first.
const VALID_SHORT = /^(yes|no|ok|okay|true|false|yep|nope|yeah|nah|\d+|[a-z]{1,5})$/i

/**
 * Detect frustration level from a user message.
 *
 * @param message - The user's message text
 * @returns FrustrationLevel: 'high' for explicit, 'mild' for implicit, 'none' otherwise
 */
export function detectFrustration(message: string): FrustrationLevel {
  const trimmed = message.trim()
  if (!trimmed) return 'none'

  // Explicit frustration patterns → high
  if (EXPLICIT_FRUSTRATION.test(trimmed)) return 'high'

  // Implicit keyword patterns → mild
  if (IMPLICIT_FRUSTRATION.test(trimmed)) return 'mild'

  // Short responses like "what?" or "huh?" → mild
  if (IMPLICIT_SHORT_RESPONSES.test(trimmed)) return 'mild'

  // Short message without question mark (< 15 chars) → mild
  // But allow valid short answers (EC-HIGH: false positive guard)
  if (trimmed.length < 15 && !trimmed.includes('?')) {
    if (VALID_SHORT.test(trimmed)) return 'none'
    return 'mild'
  }

  return 'none'
}

/**
 * Process a user message and compute the new hint level.
 *
 * @param message - User message text
 * @param currentLevel - Current hint level (0-4)
 * @param consecutiveStuckCount - Number of consecutive exchanges at the same level
 * @returns New hint level (0-4) and updated stuck count
 */
export function processUserMessage(
  message: string,
  currentLevel: number,
  consecutiveStuckCount: number
): { hintLevel: number; stuckCount: number } {
  const frustration = detectFrustration(message)

  let newLevel = currentLevel
  let newStuckCount = consecutiveStuckCount

  if (frustration === 'high') {
    // Explicit frustration: escalate by 2
    newLevel = Math.min(4, currentLevel + 2)
    newStuckCount = 0
  } else if (frustration === 'mild') {
    // Implicit frustration: escalate by 1
    newLevel = Math.min(4, currentLevel + 1)
    newStuckCount = 0
  } else {
    // No frustration detected — check auto-escalation
    newStuckCount = consecutiveStuckCount + 1

    // Auto-escalate after 2 consecutive exchanges without progress
    if (newStuckCount >= 2) {
      newLevel = Math.min(4, currentLevel + 1)
      newStuckCount = 0
    }
  }

  // TODO(E57-S05 or future): add de-escalation when user demonstrates understanding
  // (correct answer → reduce hintLevel)
  return { hintLevel: newLevel, stuckCount: newStuckCount }
}

/**
 * Get the hint instruction for a given level.
 *
 * @param level - Hint level (0-4)
 * @returns Instruction string for the system prompt
 */
export function getHintInstruction(level: number): string {
  const clamped = Math.max(0, Math.min(4, level))
  return HINT_INSTRUCTIONS[clamped]
}

/**
 * Reset hint ladder to initial state.
 */
export function resetHintLadder(): { hintLevel: number; stuckCount: number } {
  return { hintLevel: 0, stuckCount: 0 }
}

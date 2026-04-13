/**
 * Conversation Pruner (E73-S01)
 *
 * Mode-aware conversation history pruner. Trims messages to fit within
 * a token budget while preserving semantic coherence:
 *
 * - Quiz: preserves question-answer-feedback triplets as atomic units
 * - Debug: preserves student-explanation + tutor-analysis pairs
 * - Others: standard sliding window (newest messages kept)
 *
 * The first message is always preserved, and a 1-sentence prune summary
 * is prepended when messages are removed.
 */

import type { TutorMode } from '@/ai/tutor/types'
import type { ChatMessage } from '@/ai/rag/types'
import { estimateTokens } from '@/ai/tutor/transcriptContext'

/**
 * Prune conversation messages to fit within a token budget.
 *
 * @param messages - Full conversation history
 * @param maxTokens - Maximum tokens for the history slot
 * @param mode - Active tutor mode (determines pruning strategy)
 * @returns Pruned messages array (may include a prune summary as first system message)
 */
export function pruneConversation(
  messages: ChatMessage[],
  maxTokens: number,
  mode: TutorMode
): ChatMessage[] {
  if (messages.length === 0) return []

  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  if (totalTokens <= maxTokens) return messages

  switch (mode) {
    case 'quiz':
      return pruneTriplets(messages, maxTokens)
    case 'debug':
      return prunePairs(messages, maxTokens)
    default:
      return pruneWindow(messages, maxTokens)
  }
}

/**
 * Standard sliding window: keep first message + newest messages that fit.
 */
function pruneWindow(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  const first = messages[0]
  const firstTokens = estimateTokens(first.content)
  let remaining = maxTokens - firstTokens

  // Collect from the end
  const kept: ChatMessage[] = []
  for (let i = messages.length - 1; i > 0; i--) {
    const tokens = estimateTokens(messages[i].content)
    if (remaining - tokens < 0) break
    remaining -= tokens
    kept.unshift(messages[i])
  }

  const pruned = messages.length - 1 - kept.length
  if (pruned === 0) return messages

  return [first, makePruneSummary(pruned), ...kept]
}

/**
 * Quiz mode: preserve question-answer-feedback triplets (user, assistant, user, assistant pattern).
 * Prunes oldest triplets first.
 */
function pruneTriplets(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  const first = messages[0]
  const rest = messages.slice(1)

  // Group into triplets: [assistant-question, user-answer, assistant-feedback]
  const triplets: ChatMessage[][] = []
  let current: ChatMessage[] = []

  for (const msg of rest) {
    current.push(msg)
    // A triplet ends after an assistant message following a user message
    if (msg.role === 'assistant' && current.length >= 2) {
      triplets.push(current)
      current = []
    }
  }
  // Leftover partial group
  if (current.length > 0) triplets.push(current)

  // Keep triplets from newest, drop oldest until within budget
  const firstTokens = estimateTokens(first.content)
  let remaining = maxTokens - firstTokens

  const kept: ChatMessage[][] = []
  for (let i = triplets.length - 1; i >= 0; i--) {
    const groupTokens = triplets[i].reduce((s, m) => s + estimateTokens(m.content), 0)
    if (remaining - groupTokens < 0) break
    remaining -= groupTokens
    kept.unshift(triplets[i])
  }

  const prunedCount = rest.length - kept.flat().length
  if (prunedCount === 0) return messages

  return [first, makePruneSummary(prunedCount), ...kept.flat()]
}

/**
 * Debug mode: preserve student-explanation + tutor-analysis pairs.
 * Prunes oldest pairs first.
 */
function prunePairs(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  const first = messages[0]
  const rest = messages.slice(1)

  // Group into role-based pairs: each user message + the assistant reply that follows it.
  // This handles non-alternating sequences (system messages, consecutive same-role messages)
  // by grouping all messages between user messages as one logical pair.
  const pairs: ChatMessage[][] = []
  let current: ChatMessage[] = []
  for (const msg of rest) {
    if (msg.role === 'user' && current.length > 0) {
      pairs.push(current)
      current = []
    }
    current.push(msg)
  }
  if (current.length > 0) pairs.push(current)

  const firstTokens = estimateTokens(first.content)
  let remaining = maxTokens - firstTokens

  const kept: ChatMessage[][] = []
  for (let i = pairs.length - 1; i >= 0; i--) {
    const pairTokens = pairs[i].reduce((s, m) => s + estimateTokens(m.content), 0)
    if (remaining - pairTokens < 0) break
    remaining -= pairTokens
    kept.unshift(pairs[i])
  }

  const prunedCount = rest.length - kept.flat().length
  if (prunedCount === 0) return messages

  return [first, makePruneSummary(prunedCount), ...kept.flat()]
}

/** Monotonic counter to ensure unique prune-summary IDs across multiple prune operations */
let pruneSummaryCounter = 0

/**
 * Reset the prune summary counter to 0.
 * Call this in `beforeEach` in tests to prevent counter state leaking between test cases.
 */
export function resetPruneSummaryCounter(): void {
  pruneSummaryCounter = 0
}

/** Create a system message summarizing what was pruned.
 *
 * @param prunedCount - Number of messages that were pruned
 * @param timestamp - Optional deterministic timestamp (defaults to Date.now(); pass a fixed
 *   value in tests to keep snapshots stable)
 */
export function makePruneSummary(prunedCount: number, timestamp?: number): ChatMessage {
  return {
    id: `prune-summary-${++pruneSummaryCounter}`,
    role: 'system',
    content: `[${prunedCount} earlier messages were summarized to fit the conversation window.]`,
    timestamp: timestamp ?? Date.now(),
  }
}

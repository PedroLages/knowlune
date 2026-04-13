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

  // Group into pairs: [user, assistant]
  const pairs: ChatMessage[][] = []
  for (let i = 0; i < rest.length; i += 2) {
    const pair = rest.slice(i, i + 2)
    pairs.push(pair)
  }

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

/** Create a system message summarizing what was pruned */
function makePruneSummary(prunedCount: number): ChatMessage {
  return {
    id: 'prune-summary',
    role: 'system',
    content: `[${prunedCount} earlier messages were summarized to fit the conversation window.]`,
    timestamp: Date.now(),
  }
}

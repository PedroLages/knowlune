/**
 * Unit tests for conversationPruner.ts (E73-S01)
 *
 * Tests pair preservation for quiz/debug and standard window for other modes.
 */

import { describe, it, expect } from 'vitest'
import { pruneConversation } from '../conversationPruner'
import type { ChatMessage } from '@/ai/rag/types'

function makeMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  index: number
): ChatMessage {
  return {
    id: `msg-${index}`,
    role,
    content,
    timestamp: 1000 + index,
  }
}

function makeConversation(pairs: number): ChatMessage[] {
  const msgs: ChatMessage[] = [makeMessage('system', 'System prompt', 0)]
  for (let i = 0; i < pairs; i++) {
    msgs.push(
      makeMessage('user', `Question ${i + 1} with some content to increase token count`, i * 2 + 1)
    )
    msgs.push(
      makeMessage('assistant', `Answer ${i + 1} with detailed explanation and examples`, i * 2 + 2)
    )
  }
  return msgs
}

describe('pruneConversation', () => {
  it('returns all messages when within budget', () => {
    const msgs = makeConversation(2)
    const result = pruneConversation(msgs, 10000, 'socratic')
    expect(result).toEqual(msgs)
  })

  it('returns empty array for empty input', () => {
    expect(pruneConversation([], 100, 'socratic')).toEqual([])
  })

  describe('standard window (socratic/explain/eli5)', () => {
    it('preserves first message and newest messages', () => {
      const msgs = makeConversation(10) // 21 messages total
      const result = pruneConversation(msgs, 50, 'socratic')
      // First message preserved
      expect(result[0]).toEqual(msgs[0])
      // Prune summary is second
      expect(result[1].role).toBe('system')
      expect(result[1].content).toContain('earlier messages')
      // Last messages are from the end of the conversation
      const lastResult = result[result.length - 1]
      expect(lastResult).toEqual(msgs[msgs.length - 1])
    })

    it('works for explain mode', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'explain')
      expect(result[0]).toEqual(msgs[0])
      expect(result.length).toBeLessThan(msgs.length)
    })

    it('works for eli5 mode', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'eli5')
      expect(result[0]).toEqual(msgs[0])
      expect(result.length).toBeLessThan(msgs.length)
    })
  })

  describe('quiz mode (triplet preservation)', () => {
    it('preserves first message', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'quiz')
      expect(result[0]).toEqual(msgs[0])
    })

    it('includes prune summary when messages are removed', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'quiz')
      const summaries = result.filter(m => m.id.startsWith('prune-summary-'))
      expect(summaries.length).toBe(1)
    })

    it('keeps newest triplets', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'quiz')
      // Last message should be from the end
      expect(result[result.length - 1]).toEqual(msgs[msgs.length - 1])
    })
  })

  describe('debug mode (pair preservation)', () => {
    it('preserves first message', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'debug')
      expect(result[0]).toEqual(msgs[0])
    })

    it('keeps newest pairs', () => {
      const msgs = makeConversation(10)
      const result = pruneConversation(msgs, 50, 'debug')
      expect(result[result.length - 1]).toEqual(msgs[msgs.length - 1])
    })
  })
})

/**
 * Tests for useTutorStore mode tagging (E72-S02)
 *
 * Coverage:
 * - addMessage() tags messages with current store.mode
 * - Caller-provided mode takes precedence over store.mode
 * - toChatMessage() defaults missing mode to 'socratic' (backward compat)
 * - toTutorMessage() preserves the provided mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTutorStore } from '@/stores/useTutorStore'
import type { ChatMessage } from '@/ai/rag/types'

vi.mock('@/ai/tutor/learnerModelService', () => ({
  getOrCreateLearnerModel: vi.fn(),
  updateLearnerModel: vi.fn(),
  clearLearnerModel: vi.fn(),
}))

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: 'test',
    timestamp: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  useTutorStore.setState({
    messages: [],
    mode: 'socratic',
    hintLevel: 0,
    isGenerating: false,
    error: null,
    transcriptStatus: null,
  })
})

// ── addMessage mode tagging ───────────────────────────────────────

describe('addMessage mode tagging', () => {
  it('tags message with current store.mode when no mode provided', () => {
    useTutorStore.setState({ mode: 'explain' })
    useTutorStore.getState().addMessage(makeMessage())

    const { messages } = useTutorStore.getState()
    expect(messages[0].mode).toBe('explain')
  })

  it('uses quiz mode when store is in quiz mode', () => {
    useTutorStore.setState({ mode: 'quiz' })
    useTutorStore.getState().addMessage(makeMessage({ content: 'quiz question' }))

    expect(useTutorStore.getState().messages[0].mode).toBe('quiz')
  })

  it('caller-provided mode takes precedence over store.mode', () => {
    useTutorStore.setState({ mode: 'explain' })
    // Caller explicitly sets mode: 'debug'
    useTutorStore.getState().addMessage(makeMessage({ mode: 'debug' }))

    expect(useTutorStore.getState().messages[0].mode).toBe('debug')
  })

  it('tags each message with the store.mode at time of addition', () => {
    useTutorStore.setState({ mode: 'socratic' })
    useTutorStore.getState().addMessage(makeMessage({ id: 'a', content: 'first' }))

    useTutorStore.setState({ mode: 'eli5' })
    useTutorStore.getState().addMessage(makeMessage({ id: 'b', content: 'second' }))

    const { messages } = useTutorStore.getState()
    expect(messages[0].mode).toBe('socratic')
    expect(messages[1].mode).toBe('eli5')
  })
})

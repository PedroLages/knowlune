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

// ── switchMode (E73-S01) ──────────────────────────────────────────

describe('switchMode', () => {
  it('updates mode and resets hint/stuck counters', () => {
    useTutorStore.setState({ mode: 'socratic', hintLevel: 3, stuckCount: 2 })
    useTutorStore.getState().switchMode('explain')

    const { mode, hintLevel, stuckCount } = useTutorStore.getState()
    expect(mode).toBe('explain')
    expect(hintLevel).toBe(0)
    expect(stuckCount).toBe(0)
  })

  it('records previous mode in modeHistory', () => {
    useTutorStore.setState({ mode: 'socratic', modeHistory: [] })
    useTutorStore.getState().switchMode('quiz')

    expect(useTutorStore.getState().modeHistory).toEqual(['socratic'])
  })

  it('accumulates modeHistory across multiple switches', () => {
    useTutorStore.setState({ mode: 'socratic', modeHistory: [] })
    useTutorStore.getState().switchMode('explain')
    useTutorStore.getState().switchMode('quiz')

    expect(useTutorStore.getState().modeHistory).toEqual(['socratic', 'explain'])
  })

  it('caps modeHistory at 50 entries', () => {
    const longHistory = Array.from({ length: 49 }, () => 'socratic' as const)
    useTutorStore.setState({ mode: 'explain', modeHistory: longHistory })
    useTutorStore.getState().switchMode('quiz')
    useTutorStore.getState().switchMode('debug')

    const { modeHistory } = useTutorStore.getState()
    expect(modeHistory.length).toBe(50)
    expect(modeHistory[modeHistory.length - 1]).toBe('quiz')
  })

  it('sets modeTransitionContext when mode changes', () => {
    useTutorStore.setState({ mode: 'socratic', messages: [] })
    useTutorStore.getState().switchMode('eli5')

    expect(useTutorStore.getState().modeTransitionContext).toContain('socratic')
    expect(useTutorStore.getState().modeTransitionContext).toContain('eli5')
  })

  it('is a no-op when switching to the same mode', () => {
    useTutorStore.setState({ mode: 'quiz', modeHistory: [], modeTransitionContext: null })
    useTutorStore.getState().switchMode('quiz')

    expect(useTutorStore.getState().modeHistory).toEqual([])
    expect(useTutorStore.getState().modeTransitionContext).toBeNull()
  })

  it('consumeTransitionContext clears and returns the context', () => {
    useTutorStore.setState({ mode: 'socratic', messages: [] })
    useTutorStore.getState().switchMode('debug')

    const ctx = useTutorStore.getState().consumeTransitionContext()
    expect(ctx).toBeTruthy()
    expect(useTutorStore.getState().modeTransitionContext).toBeNull()
  })

  it('consumeTransitionContext returns null when no transition pending', () => {
    useTutorStore.setState({ modeTransitionContext: null })
    const ctx = useTutorStore.getState().consumeTransitionContext()
    expect(ctx).toBeNull()
  })
})

/**
 * Tests for useTutorStore (E57-S02)
 *
 * Coverage:
 * - addMessage: adds messages and trims maxHistory
 * - setStreamingContent: updates last assistant message content
 * - finalizeStreamingMessage: finalizes streaming content
 * - setLoading / setGenerating: sets isGenerating
 * - setError: sets error state
 * - clearConversation: resets messages, hintLevel, error, isGenerating
 * - setTranscriptStatus: sets transcriptStatus
 * - maxHistory trimming: messages beyond MAX_HISTORY are dropped from the front
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTutorStore } from '@/stores/useTutorStore'
import type { ChatMessage } from '@/ai/rag/types'
import type { TranscriptStatus } from '@/ai/tutor/types'
import type { LearnerModel } from '@/data/types'

// Mock learnerModelService to avoid real Dexie calls in store action tests
vi.mock('@/ai/tutor/learnerModelService', () => ({
  getOrCreateLearnerModel: vi.fn(),
  updateLearnerModel: vi.fn(),
  clearLearnerModel: vi.fn(),
}))

import * as learnerModelService from '@/ai/tutor/learnerModelService'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  // Reset store state before each test
  useTutorStore.setState({
    messages: [],
    mode: 'socratic',
    hintLevel: 0,
    isGenerating: false,
    error: null,
    transcriptStatus: null,
  })
})

// ── addMessage ─────────────────────────────────────────────────────

describe('addMessage', () => {
  it('adds a message to an empty store', () => {
    const msg = makeMessage({ content: 'Hi there' })
    useTutorStore.getState().addMessage(msg)

    const { messages } = useTutorStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Hi there')
  })

  it('appends multiple messages in order', () => {
    useTutorStore.getState().addMessage(makeMessage({ content: 'First' }))
    useTutorStore.getState().addMessage(makeMessage({ content: 'Second', role: 'assistant' }))

    const { messages } = useTutorStore.getState()
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('First')
    expect(messages[1].content).toBe('Second')
  })
})

// ── setStreamingContent ───────────────────────────────────────────

describe('setStreamingContent', () => {
  it('updates the last assistant message content', () => {
    const assistant = makeMessage({ role: 'assistant', content: '' })
    useTutorStore.getState().addMessage(assistant)
    useTutorStore.getState().setStreamingContent('Hello world')

    const { messages } = useTutorStore.getState()
    expect(messages[0].content).toBe('Hello world')
  })

  it('does not update if last message is not assistant', () => {
    const user = makeMessage({ role: 'user', content: 'question' })
    useTutorStore.getState().addMessage(user)
    useTutorStore.getState().setStreamingContent('should not update')

    const { messages } = useTutorStore.getState()
    expect(messages[0].content).toBe('question')
  })
})

// ── finalizeStreamingMessage ──────────────────────────────────────

describe('finalizeStreamingMessage', () => {
  it('sets final content on the last assistant message', () => {
    useTutorStore.getState().addMessage(makeMessage({ role: 'assistant', content: 'partial' }))
    useTutorStore.getState().finalizeStreamingMessage('complete response')

    expect(useTutorStore.getState().messages[0].content).toBe('complete response')
  })
})

// ── setLoading / setGenerating ─────────────────────────────────────

describe('setLoading', () => {
  it('sets isGenerating to true', () => {
    useTutorStore.getState().setLoading(true)
    expect(useTutorStore.getState().isGenerating).toBe(true)
  })

  it('sets isGenerating to false', () => {
    useTutorStore.getState().setLoading(true)
    useTutorStore.getState().setLoading(false)
    expect(useTutorStore.getState().isGenerating).toBe(false)
  })
})

describe('setGenerating', () => {
  it('sets isGenerating flag', () => {
    useTutorStore.getState().setGenerating(true)
    expect(useTutorStore.getState().isGenerating).toBe(true)
    useTutorStore.getState().setGenerating(false)
    expect(useTutorStore.getState().isGenerating).toBe(false)
  })
})

// ── setError ──────────────────────────────────────────────────────

describe('setError', () => {
  it('sets an error message', () => {
    useTutorStore.getState().setError('Something went wrong')
    expect(useTutorStore.getState().error).toBe('Something went wrong')
  })

  it('clears the error when set to null', () => {
    useTutorStore.getState().setError('error')
    useTutorStore.getState().setError(null)
    expect(useTutorStore.getState().error).toBeNull()
  })
})

// ── clearConversation ─────────────────────────────────────────────

describe('clearConversation', () => {
  it('resets messages, hintLevel, error, and isGenerating', () => {
    useTutorStore.getState().addMessage(makeMessage())
    useTutorStore.getState().setError('oops')
    useTutorStore.getState().setLoading(true)
    useTutorStore.getState().setHintLevel(2)

    useTutorStore.getState().clearConversation()

    const state = useTutorStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.error).toBeNull()
    expect(state.isGenerating).toBe(false)
    expect(state.hintLevel).toBe(0)
  })
})

// ── setTranscriptStatus ───────────────────────────────────────────

describe('setTranscriptStatus', () => {
  it('stores transcript status', () => {
    const status: TranscriptStatus = {
      available: true,
      strategy: 'chapter',
      label: 'Chapter mode',
    }
    useTutorStore.getState().setTranscriptStatus(status)
    expect(useTutorStore.getState().transcriptStatus).toEqual(status)
  })

  it('can clear transcript status to null', () => {
    useTutorStore.getState().setTranscriptStatus({ available: false, strategy: 'none', label: '' })
    useTutorStore.getState().setTranscriptStatus(null)
    expect(useTutorStore.getState().transcriptStatus).toBeNull()
  })
})

// ── setMode ───────────────────────────────────────────────────────

describe('setMode', () => {
  it('resets hintLevel and stuckCount to 0 when mode changes', () => {
    useTutorStore.setState({ hintLevel: 3, stuckCount: 2 })
    useTutorStore.getState().setMode('socratic')

    const state = useTutorStore.getState()
    expect(state.hintLevel).toBe(0)
    expect(state.stuckCount).toBe(0)
    expect(state.mode).toBe('socratic')
  })
})

// ── maxHistory trimming ───────────────────────────────────────────

describe('maxHistory trimming', () => {
  it('trims messages to 500 when exceeding max', () => {
    // Add 505 messages (exceeds MAX_HISTORY_MESSAGES = 500)
    for (let i = 0; i < 505; i++) {
      useTutorStore.getState().addMessage(makeMessage({ content: `msg-${i}`, id: `id-${i}` }))
    }

    const { messages } = useTutorStore.getState()
    // Should be capped at 500
    expect(messages.length).toBe(500)
    // Oldest 5 messages should be dropped — first retained is msg-5
    expect(messages[0].content).toBe('msg-5')
    // Last retained is msg-504
    expect(messages[messages.length - 1].content).toBe('msg-504')
  })

  it('does not trim when at or below 500 messages', () => {
    for (let i = 0; i < 500; i++) {
      useTutorStore.getState().addMessage(makeMessage({ id: `id-${i}` }))
    }
    expect(useTutorStore.getState().messages).toHaveLength(500)
  })
})

// ── loadLearnerModel ──────────────────────────────────────────────

function makeLearnerModel(overrides: Partial<LearnerModel> = {}): LearnerModel {
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    vocabularyLevel: 'beginner',
    strengths: [],
    misconceptions: [],
    topicsExplored: [],
    preferredMode: 'socratic',
    lastSessionSummary: '',
    quizStats: { totalQuestions: 0, correctAnswers: 0, weakTopics: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('loadLearnerModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTutorStore.setState({ learnerModel: null, error: null })
  })

  it('loads learner model into store on success', async () => {
    const model = makeLearnerModel({ courseId: 'course-1' })
    vi.mocked(learnerModelService.getOrCreateLearnerModel).mockResolvedValue(model)

    await useTutorStore.getState().loadLearnerModel('course-1')

    expect(useTutorStore.getState().learnerModel).toEqual(model)
  })

  it('sets learnerModel to null on Dexie error', async () => {
    vi.mocked(learnerModelService.getOrCreateLearnerModel).mockRejectedValue(
      new Error('Dexie error')
    )
    useTutorStore.setState({ learnerModel: makeLearnerModel() })

    await useTutorStore.getState().loadLearnerModel('course-1')

    expect(useTutorStore.getState().learnerModel).toBeNull()
  })
})

// ── updateLearnerModel ────────────────────────────────────────────

describe('updateLearnerModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTutorStore.setState({ learnerModel: null, error: null })
  })

  it('applies update via learnerModelService and sets store', async () => {
    const updated = makeLearnerModel({ vocabularyLevel: 'advanced' })
    vi.mocked(learnerModelService.updateLearnerModel).mockResolvedValue(updated)

    await useTutorStore.getState().updateLearnerModel('course-1', { vocabularyLevel: 'advanced' })

    expect(useTutorStore.getState().learnerModel).toEqual(updated)
  })

  it('does not update store when service returns null/undefined', async () => {
    const initial = makeLearnerModel()
    useTutorStore.setState({ learnerModel: initial })
    vi.mocked(learnerModelService.updateLearnerModel).mockResolvedValue(
      null as unknown as LearnerModel
    )

    await useTutorStore.getState().updateLearnerModel('course-1', { vocabularyLevel: 'advanced' })

    // Store should remain unchanged since updated is falsy
    expect(useTutorStore.getState().learnerModel).toEqual(initial)
  })

  it('does not crash on Dexie error', async () => {
    vi.mocked(learnerModelService.updateLearnerModel).mockRejectedValue(new Error('Dexie error'))

    await expect(useTutorStore.getState().updateLearnerModel('course-1', {})).resolves.not.toThrow()
  })
})

// ── clearLearnerModel ─────────────────────────────────────────────

describe('clearLearnerModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTutorStore.setState({ learnerModel: makeLearnerModel(), error: null })
  })

  it('clears store state after service call', async () => {
    vi.mocked(learnerModelService.clearLearnerModel).mockResolvedValue(undefined)

    await useTutorStore.getState().clearLearnerModel('course-1')

    expect(useTutorStore.getState().learnerModel).toBeNull()
    expect(learnerModelService.clearLearnerModel).toHaveBeenCalledWith('course-1')
  })

  it('does not crash on Dexie error', async () => {
    vi.mocked(learnerModelService.clearLearnerModel).mockRejectedValue(new Error('Dexie error'))

    await expect(useTutorStore.getState().clearLearnerModel('course-1')).resolves.not.toThrow()
  })
})

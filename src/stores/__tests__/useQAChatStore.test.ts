/**
 * Tests for Q&A Chat Store
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useQAChatStore } from '../useQAChatStore'
import type { RetrievedNote } from '@/lib/noteQA'
import type { Note } from '@/data/types'

describe('useQAChatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useQAChatStore.getState().clearHistory()
  })

  describe('initial state', () => {
    it('should initialize with empty messages', () => {
      const { messages } = useQAChatStore.getState()
      expect(messages).toEqual([])
    })

    it('should initialize with isGenerating false', () => {
      const { isGenerating } = useQAChatStore.getState()
      expect(isGenerating).toBe(false)
    })

    it('should initialize with no error', () => {
      const { error } = useQAChatStore.getState()
      expect(error).toBe(null)
    })
  })

  describe('addQuestion', () => {
    it('should add question message to history', () => {
      const { addQuestion } = useQAChatStore.getState()
      const messageId = addQuestion('What are React hooks?')

      const { messages } = useQAChatStore.getState()
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        id: messageId,
        type: 'question',
        content: 'What are React hooks?',
      })
      expect(messages[0].timestamp).toBeInstanceOf(Date)
    })

    it('should clear previous error when adding question', () => {
      const { addQuestion, setError } = useQAChatStore.getState()

      setError('Previous error')
      expect(useQAChatStore.getState().error).toBe('Previous error')

      addQuestion('New question')
      expect(useQAChatStore.getState().error).toBe(null)
    })

    it('should return unique message ID', () => {
      const { addQuestion } = useQAChatStore.getState()

      const id1 = addQuestion('Question 1')
      const id2 = addQuestion('Question 2')

      expect(id1).not.toBe(id2)
    })
  })

  describe('addAnswer', () => {
    const mockRetrievedNotes: RetrievedNote[] = [
      {
        note: {
          id: 'note-1',
          courseId: '001',
          videoId: '001-001',
          content: 'Test note',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          tags: [],
        } as Note,
        similarity: 0.9,
      },
    ]

    it('should add answer message with citations', () => {
      const { addAnswer } = useQAChatStore.getState()
      const citations = ['note-1', 'note-2']

      const messageId = addAnswer('React hooks are useful.', citations, mockRetrievedNotes)

      const { messages } = useQAChatStore.getState()
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        id: messageId,
        type: 'answer',
        content: 'React hooks are useful.',
        citations,
        retrievedNotes: mockRetrievedNotes,
      })
    })
  })

  describe('updateAnswer', () => {
    it('should update answer content for streaming', () => {
      const { addAnswer, updateAnswer } = useQAChatStore.getState()

      const messageId = addAnswer('React', [], [])
      updateAnswer(messageId, 'React hooks')
      updateAnswer(messageId, 'React hooks are useful')

      const { messages } = useQAChatStore.getState()
      expect(messages[0].content).toBe('React hooks are useful')
    })

    it('should not update other messages', () => {
      const { addAnswer, updateAnswer } = useQAChatStore.getState()

      const id1 = addAnswer('Answer 1', [], [])
      addAnswer('Answer 2', [], [])

      updateAnswer(id1, 'Updated Answer 1')

      const { messages } = useQAChatStore.getState()
      expect(messages[0].content).toBe('Updated Answer 1')
      expect(messages[1].content).toBe('Answer 2')
    })
  })

  describe('setGenerating', () => {
    it('should update isGenerating state', () => {
      const { setGenerating } = useQAChatStore.getState()

      setGenerating(true)
      expect(useQAChatStore.getState().isGenerating).toBe(true)

      setGenerating(false)
      expect(useQAChatStore.getState().isGenerating).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const { setError } = useQAChatStore.getState()

      setError('API timeout')
      expect(useQAChatStore.getState().error).toBe('API timeout')
    })

    it('should clear error when set to null', () => {
      const { setError } = useQAChatStore.getState()

      setError('Error')
      setError(null)
      expect(useQAChatStore.getState().error).toBe(null)
    })
  })

  describe('clearHistory', () => {
    it('should clear all messages', () => {
      const { addQuestion, addAnswer, clearHistory } = useQAChatStore.getState()

      addQuestion('Question 1')
      addAnswer('Answer 1', [], [])
      addQuestion('Question 2')

      clearHistory()

      const { messages } = useQAChatStore.getState()
      expect(messages).toEqual([])
    })

    it('should reset error and generating state', () => {
      const { setError, setGenerating, clearHistory } = useQAChatStore.getState()

      setError('Error')
      setGenerating(true)

      clearHistory()

      const { error, isGenerating } = useQAChatStore.getState()
      expect(error).toBe(null)
      expect(isGenerating).toBe(false)
    })
  })
})

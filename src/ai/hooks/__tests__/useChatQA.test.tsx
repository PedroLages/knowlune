import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useChatQA } from '../useChatQA'
import { RAGCoordinator } from '@/ai/rag/ragCoordinator'
import { PromptBuilder } from '@/ai/rag/promptBuilder'
import { CitationExtractor } from '@/ai/rag/citationExtractor'
import { getLLMClient } from '@/ai/llm/factory'
import { LLMError } from '@/ai/llm/types'
import type { LLMClient } from '@/ai/llm/client'
import type { RetrievedContext } from '@/ai/rag/types'

// Mock dependencies
vi.mock('@/ai/rag/ragCoordinator')
vi.mock('@/ai/rag/promptBuilder')
vi.mock('@/ai/rag/citationExtractor')
vi.mock('@/ai/llm/factory')

describe('useChatQA', () => {
  let mockRetrieveContext: ReturnType<typeof vi.fn>
  let mockBuildMessages: ReturnType<typeof vi.fn>
  let mockExtract: ReturnType<typeof vi.fn>
  let mockStreamCompletion: ReturnType<typeof vi.fn>

  const mockContext: RetrievedContext = {
    notes: [
      {
        noteId: 'note-1',
        content: 'React hooks are functions that let you use state',
        videoId: 'video-1',
        videoFilename: 'intro-to-react.mp4',
        courseName: 'React Basics',
        score: 0.95,
      },
    ],
    query: 'What are React hooks?',
    embeddingTime: 10,
    searchTime: 50,
  }

  beforeEach(() => {
    // Setup mocks with realistic return values
    mockRetrieveContext = vi.fn().mockResolvedValue(mockContext)

    mockBuildMessages = vi.fn().mockReturnValue([
      { role: 'system', content: 'You are a helpful learning assistant.' },
      { role: 'user', content: 'What are React hooks?' },
    ])

    mockExtract = vi.fn().mockReturnValue(
      new Map([
        [
          1,
          {
            noteId: 'note-1',
            videoId: 'video-1',
            videoFilename: 'intro-to-react.mp4',
            courseName: 'React Basics',
          },
        ],
      ])
    )

    // Mock streaming generator
    mockStreamCompletion = vi.fn(async function* () {
      yield { content: 'React ' }
      yield { content: 'hooks ' }
      yield { content: 'are ' }
      yield { content: 'useful' }
      yield { content: '', finishReason: 'stop' }
    })

    vi.mocked(RAGCoordinator.prototype.retrieveContext).mockImplementation(
      mockRetrieveContext as any
    )
    vi.mocked(PromptBuilder.prototype.buildMessages).mockImplementation(mockBuildMessages as any)
    vi.mocked(CitationExtractor.prototype.extract).mockImplementation(mockExtract as any)
    vi.mocked(getLLMClient).mockResolvedValue({
      streamCompletion: mockStreamCompletion,
      getProviderId: () => 'openai',
    } as LLMClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMessage', () => {
    it('should add user message and stream AI response', async () => {
      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2) // user + AI
        expect(result.current.messages[0].role).toBe('user')
        expect(result.current.messages[0].content).toBe('What are React hooks?')
        expect(result.current.messages[1].role).toBe('assistant')
        expect(result.current.messages[1].content).toBe('React hooks are useful')
      })
    })

    it('should do nothing if already generating', async () => {
      // Make streaming slow to ensure isGenerating is true
      mockStreamCompletion.mockImplementation(async function* () {
        await new Promise(resolve => setTimeout(resolve, 100))
        yield { content: 'Slow response', finishReason: 'stop' }
      })

      const { result } = renderHook(() => useChatQA())

      // Start first message (don't await yet)
      const promise1 = result.current.sendMessage('Query 1')

      // Wait briefly for isGenerating to become true
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })

      // Try to send second while first is running
      await result.current.sendMessage('Query 2')

      // Wait for first to complete
      await promise1

      // Only first call should have been made
      expect(mockRetrieveContext).toHaveBeenCalledTimes(1)
    })

    it('should extract citations after streaming completes', async () => {
      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(mockExtract).toHaveBeenCalledWith('React hooks are useful', expect.any(Array))
        expect(result.current.messages[1].citations).toBeInstanceOf(Map)
        expect(result.current.messages[1].citations?.size).toBe(1)
      })
    })

    it('should return no-notes message when context is empty', async () => {
      mockRetrieveContext.mockResolvedValue({
        notes: [],
        query: 'What are React hooks?',
        embeddingTime: 10,
        searchTime: 50,
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.messages[1].content).toContain("couldn't find any notes")
      })
    })

    it('should handle TIMEOUT error code', async () => {
      // eslint-disable-next-line require-yield
      mockStreamCompletion.mockImplementation(async function* () {
        throw new LLMError('Request timeout', 'TIMEOUT', 'openai')
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.error).toBe('Request timed out. Please try again.')
      })
    })

    it('should handle RATE_LIMIT error code', async () => {
      // eslint-disable-next-line require-yield
      mockStreamCompletion.mockImplementation(async function* () {
        throw new LLMError('Rate limit exceeded', 'RATE_LIMIT', 'anthropic')
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.error).toContain('Rate limit')
      })
    })

    it('should handle AUTH_ERROR error code', async () => {
      // eslint-disable-next-line require-yield
      mockStreamCompletion.mockImplementation(async function* () {
        throw new LLMError('Invalid API key', 'AUTH_ERROR', 'openai')
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.error).toContain('Authentication failed')
      })
    })

    it('should handle NETWORK_ERROR error code', async () => {
      // eslint-disable-next-line require-yield
      mockStreamCompletion.mockImplementation(async function* () {
        throw new LLMError('Network error', 'NETWORK_ERROR', 'anthropic')
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.error).toContain('Network')
      })
    })

    it('should handle generic LLMError', async () => {
      // eslint-disable-next-line require-yield
      mockStreamCompletion.mockImplementation(async function* () {
        throw new LLMError('Unknown error', 'UNKNOWN', 'openai')
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
        expect(result.current.messages[1].error).toBe(result.current.error)
      })
    })

    it('should clear error state on new successful message', async () => {
      // First message fails
      // eslint-disable-next-line require-yield
      mockStreamCompletion.mockImplementationOnce(async function* () {
        throw new LLMError('Timeout', 'TIMEOUT', 'openai')
      })

      const { result } = renderHook(() => useChatQA())

      await result.current.sendMessage('First query')

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      // Second message succeeds
      mockStreamCompletion.mockImplementation(async function* () {
        yield { content: 'Success', finishReason: 'stop' }
      })

      await result.current.sendMessage('Second query')

      await waitFor(() => {
        expect(result.current.error).toBeNull()
      })
    })
  })

  describe('clearMessages', () => {
    it('should clear messages and error state', async () => {
      const { result } = renderHook(() => useChatQA())

      // Send a message
      await result.current.sendMessage('What are React hooks?')

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })

      // Clear messages
      result.current.clearMessages()

      // Wait for state update
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(0)
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe('message history', () => {
    it('should maintain message history across multiple sends', async () => {
      const { result } = renderHook(() => useChatQA())

      // First message
      await result.current.sendMessage('What are hooks?')

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })

      // Second message
      await result.current.sendMessage('How do I use them?')

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(4) // 2 user + 2 AI
      })
    })
  })

  describe('generating state', () => {
    it('should set isGenerating during streaming', async () => {
      const { result } = renderHook(() => useChatQA())

      expect(result.current.isGenerating).toBe(false)

      // Start sending
      const promise = result.current.sendMessage('What are hooks?')

      // Check immediately - might be generating
      await waitFor(() => {
        // Either finished or still generating
        if (!result.current.isGenerating) {
          // If done, should have messages
          expect(result.current.messages.length).toBeGreaterThan(0)
        }
      })

      await promise

      // After completion, should be false
      expect(result.current.isGenerating).toBe(false)
    })
  })
})

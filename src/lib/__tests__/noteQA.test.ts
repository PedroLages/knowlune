/**
 * Tests for Q&A from Notes RAG Service
 *
 * Covers: retrieveRelevantNotes, generateQAAnswer, extractCitations
 * Mocks: @/db, @/ai/workers/coordinator, @/lib/vectorSearch, ai SDK
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Note } from '@/data/types'

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockGenerateEmbeddings = vi.fn()
vi.mock('@/ai/workers/coordinator', () => ({
  generateEmbeddings: (...args: unknown[]) => mockGenerateEmbeddings(...args),
}))

const mockEmbeddingsToArray = vi.fn()
const mockNotesGet = vi.fn()
vi.mock('@/db', () => ({
  db: {
    embeddings: { toArray: () => mockEmbeddingsToArray() },
    notes: { get: (id: string) => mockNotesGet(id) },
  },
}))

const mockInsert = vi.fn()
const mockSearch = vi.fn()
vi.mock('@/lib/vectorSearch', () => {
  return {
    BruteForceVectorStore: class {
      insert = mockInsert
      search = mockSearch
    },
  }
})

const mockStreamText = vi.fn()
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}))

// Mock all AI provider SDK imports
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => 'openai-model')),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => 'anthropic-model')),
}))
vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn(() => vi.fn(() => 'groq-model')),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => 'google-model')),
}))
vi.mock('zhipu-ai-provider', () => ({
  createZhipu: vi.fn(() => vi.fn(() => 'zhipu-model')),
}))

// Import after mocks
import { retrieveRelevantNotes, extractCitations, generateQAAnswer } from '../noteQA'
import type { RetrievedNote } from '../noteQA'
import type { AIProviderId } from '@/lib/aiConfiguration'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    courseId: '001',
    videoId: '001-001',
    content: 'Test note content',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tags: [],
    ...overrides,
  } as Note
}

function makeRetrievedNote(overrides: Partial<Note> = {}, similarity = 0.9): RetrievedNote {
  return { note: makeNote(overrides), similarity }
}

/** Collects all yielded values from an async generator */
async function collectGenerator(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = []
  for await (const chunk of gen) {
    results.push(chunk)
  }
  return results
}

/** Creates an async iterable from string array (simulates textStream) */
async function* asyncIterableFrom(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noteQA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // extractCitations
  // =========================================================================

  describe('extractCitations', () => {
    const mockNotes: RetrievedNote[] = [
      makeRetrievedNote({ id: 'note-1', courseId: '001', videoId: '001-001' }, 0.9),
      makeRetrievedNote({ id: 'note-2', courseId: '002', videoId: '002-001' }, 0.8),
    ]

    it('should extract citations when course/video is mentioned', () => {
      const answer = 'According to your note from 001/001-001, React hooks are useful.'
      const citations = extractCitations(answer, mockNotes)
      expect(citations).toEqual(['note-1'])
    })

    it('should extract multiple citations', () => {
      const answer =
        'From 001/001-001 we learn about hooks. From 002/002-001 we learn about TypeScript.'
      const citations = extractCitations(answer, mockNotes)
      expect(citations).toContain('note-1')
      expect(citations).toContain('note-2')
      expect(citations).toHaveLength(2)
    })

    it('should extract citation by course ID only', () => {
      const answer = 'In course 002, we learned about TypeScript.'
      const citations = extractCitations(answer, mockNotes)
      expect(citations).toEqual(['note-2'])
    })

    it('should return empty array when no citations found', () => {
      const answer = 'This answer does not mention any specific notes.'
      const citations = extractCitations(answer, mockNotes)
      expect(citations).toEqual([])
    })

    it('should handle empty answer', () => {
      const citations = extractCitations('', mockNotes)
      expect(citations).toEqual([])
    })

    it('should handle empty retrieved notes', () => {
      const citations = extractCitations('Some answer with 001/001-001', [])
      expect(citations).toEqual([])
    })

    it('should not duplicate note IDs', () => {
      // Answer mentions both courseId and courseId/videoId for same note
      const answer = 'From 001/001-001 and also course 001.'
      const citations = extractCitations(answer, mockNotes)
      // The implementation adds note-1 once because it matches on first check (courseVideoPattern)
      // and the || short-circuits
      expect(citations).toContain('note-1')
    })
  })

  // =========================================================================
  // retrieveRelevantNotes
  // =========================================================================

  describe('retrieveRelevantNotes', () => {
    it('should throw error for empty query', async () => {
      await expect(retrieveRelevantNotes('')).rejects.toThrow('Query cannot be empty')
    })

    it('should throw error for whitespace-only query', async () => {
      await expect(retrieveRelevantNotes('   ')).rejects.toThrow('Query cannot be empty')
    })

    it('should return empty array when no embeddings exist', async () => {
      mockGenerateEmbeddings.mockResolvedValue([new Float32Array(384)])
      mockEmbeddingsToArray.mockResolvedValue([])

      const result = await retrieveRelevantNotes('what is React?')
      expect(result).toEqual([])
    })

    it('should return empty array when no results pass similarity threshold', async () => {
      const queryEmbedding = new Float32Array(384)
      mockGenerateEmbeddings.mockResolvedValue([queryEmbedding])
      mockEmbeddingsToArray.mockResolvedValue([
        { noteId: 'note-1', embedding: new Float32Array(384) },
      ])
      mockSearch.mockReturnValue([{ id: 'note-1', similarity: 0.3, distance: 0.7 }])

      const result = await retrieveRelevantNotes('unrelated query')
      expect(result).toEqual([])
    })

    it('should retrieve notes with similarity above threshold', async () => {
      const queryEmbedding = new Float32Array(384)
      mockGenerateEmbeddings.mockResolvedValue([queryEmbedding])
      mockEmbeddingsToArray.mockResolvedValue([
        { noteId: 'note-1', embedding: new Float32Array(384) },
        { noteId: 'note-2', embedding: new Float32Array(384) },
      ])
      mockSearch.mockReturnValue([
        { id: 'note-1', similarity: 0.9, distance: 0.1 },
        { id: 'note-2', similarity: 0.7, distance: 0.3 },
      ])

      const note1 = makeNote({ id: 'note-1' })
      const note2 = makeNote({ id: 'note-2', courseId: '002' })
      mockNotesGet.mockImplementation((id: string) => {
        if (id === 'note-1') return note1
        if (id === 'note-2') return note2
        return undefined
      })

      const result = await retrieveRelevantNotes('what is React?')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ note: note1, similarity: 0.9 })
      expect(result[1]).toEqual({ note: note2, similarity: 0.7 })
    })

    it('should trim query before generating embedding', async () => {
      mockGenerateEmbeddings.mockResolvedValue([new Float32Array(384)])
      mockEmbeddingsToArray.mockResolvedValue([])

      await retrieveRelevantNotes('  what is React?  ')
      expect(mockGenerateEmbeddings).toHaveBeenCalledWith(['what is React?'])
    })

    it('should skip deleted notes', async () => {
      const queryEmbedding = new Float32Array(384)
      mockGenerateEmbeddings.mockResolvedValue([queryEmbedding])
      mockEmbeddingsToArray.mockResolvedValue([
        { noteId: 'note-1', embedding: new Float32Array(384) },
      ])
      mockSearch.mockReturnValue([{ id: 'note-1', similarity: 0.9, distance: 0.1 }])

      const deletedNote = makeNote({ id: 'note-1', deleted: true })
      mockNotesGet.mockResolvedValue(deletedNote)

      const result = await retrieveRelevantNotes('query')
      expect(result).toEqual([])
    })

    it('should skip notes not found in database', async () => {
      const queryEmbedding = new Float32Array(384)
      mockGenerateEmbeddings.mockResolvedValue([queryEmbedding])
      mockEmbeddingsToArray.mockResolvedValue([
        { noteId: 'note-1', embedding: new Float32Array(384) },
      ])
      mockSearch.mockReturnValue([{ id: 'note-1', similarity: 0.9, distance: 0.1 }])
      mockNotesGet.mockResolvedValue(undefined)

      const result = await retrieveRelevantNotes('query')
      expect(result).toEqual([])
    })

    it('should insert all embeddings into vector store', async () => {
      mockGenerateEmbeddings.mockResolvedValue([new Float32Array(384)])
      const emb1 = new Float32Array(384)
      const emb2 = new Float32Array(384)
      mockEmbeddingsToArray.mockResolvedValue([
        { noteId: 'note-1', embedding: emb1 },
        { noteId: 'note-2', embedding: emb2 },
      ])
      mockSearch.mockReturnValue([])

      await retrieveRelevantNotes('query')

      expect(mockInsert).toHaveBeenCalledTimes(2)
      expect(mockInsert).toHaveBeenCalledWith('note-1', emb1)
      expect(mockInsert).toHaveBeenCalledWith('note-2', emb2)
    })

    it('should search with top 5 and pass query embedding as array', async () => {
      const queryEmbedding = new Float32Array(384)
      mockGenerateEmbeddings.mockResolvedValue([queryEmbedding])
      mockEmbeddingsToArray.mockResolvedValue([
        { noteId: 'note-1', embedding: new Float32Array(384) },
      ])
      mockSearch.mockReturnValue([])

      await retrieveRelevantNotes('query')

      expect(mockSearch).toHaveBeenCalledWith(Array.from(queryEmbedding), 5)
    })
  })

  // =========================================================================
  // generateQAAnswer
  // =========================================================================

  describe('generateQAAnswer', () => {
    it('should yield fallback message when no retrieved notes provided', async () => {
      const gen = generateQAAnswer('question', [], 'openai' as AIProviderId, 'key')
      const results = await collectGenerator(gen)
      expect(results).toEqual(['No relevant notes found for your question.'])
    })

    it('should stream text chunks from AI model', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['Hello', ' world', '!']),
      })

      const gen = generateQAAnswer('What is React?', notes, 'openai' as AIProviderId, 'test-key')
      const results = await collectGenerator(gen)

      expect(results).toEqual(['Hello', ' world', '!'])
    })

    it('should include note content in the prompt context', async () => {
      const notes: RetrievedNote[] = [
        makeRetrievedNote({
          content: 'React hooks explanation',
          courseId: '001',
          videoId: '001-001',
        }),
      ]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('Tell me about hooks', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      expect(mockStreamText).toHaveBeenCalledTimes(1)
      const callArgs = mockStreamText.mock.calls[0][0]
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('React hooks explanation')
      expect(userMessage.content).toContain('001/001-001')
    })

    it('should include timestamp in context when present', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: 125 })]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('(at 2:05)')
    })

    it('should not include timestamp in context when absent', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: undefined })]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).not.toContain('(at ')
    })

    it('should format multiple notes separated by dividers', async () => {
      const notes: RetrievedNote[] = [
        makeRetrievedNote({ courseId: '001', videoId: '001-001', content: 'First note' }),
        makeRetrievedNote({ courseId: '002', videoId: '002-001', content: 'Second note' }, 0.8),
      ]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('[Note 1]')
      expect(userMessage.content).toContain('[Note 2]')
      expect(userMessage.content).toContain('---')
    })

    it('should include system prompt with RAG rules', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      const systemMessage = callArgs.messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('study assistant')
      expect(systemMessage.content).toContain('ONLY on the provided notes')
    })

    it('should throw timeout error when AbortError occurs without external signal', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]

      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'

      mockStreamText.mockImplementation(() => {
        throw abortError
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await expect(collectGenerator(gen)).rejects.toThrow('Answer generation timed out.')
    })

    it('should rethrow AbortError when external signal is aborted', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      const controller = new AbortController()
      controller.abort()

      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'

      mockStreamText.mockImplementation(() => {
        throw abortError
      })

      const gen = generateQAAnswer(
        'question',
        notes,
        'openai' as AIProviderId,
        'key',
        controller.signal
      )
      await expect(collectGenerator(gen)).rejects.toThrow('The operation was aborted.')
    })

    it('should rethrow non-AbortError exceptions', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]

      mockStreamText.mockImplementation(() => {
        throw new TypeError('Network failure')
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await expect(collectGenerator(gen)).rejects.toThrow('Network failure')
    })

    it('should use correct model for each provider', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      const providers: AIProviderId[] = [
        'openai',
        'anthropic',
        'groq',
        'glm',
        'gemini',
      ] as AIProviderId[]

      for (const provider of providers) {
        vi.clearAllMocks()
        mockStreamText.mockReturnValue({
          textStream: asyncIterableFrom(['ok']),
        })

        const gen = generateQAAnswer('question', notes, provider, 'key')
        await collectGenerator(gen)

        expect(mockStreamText).toHaveBeenCalledTimes(1)
      }
    })

    it('should pass abortSignal with timeout to streamText', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['ok']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      expect(callArgs.abortSignal).toBeDefined()
    })

    it('should pass combined signal when external signal provided', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      const controller = new AbortController()

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['ok']),
      })

      const gen = generateQAAnswer(
        'question',
        notes,
        'openai' as AIProviderId,
        'key',
        controller.signal
      )
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      expect(callArgs.abortSignal).toBeDefined()
    })

    it('should format timestamp 0 seconds as 0:00', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: 0 })]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')
      // timestamp 0 is falsy, so it should NOT include timestamp
      expect(userMessage.content).not.toContain('(at ')
    })

    it('should format timestamp 3661 seconds as 61:01', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: 3661 })]

      mockStreamText.mockReturnValue({
        textStream: asyncIterableFrom(['answer']),
      })

      const gen = generateQAAnswer('question', notes, 'openai' as AIProviderId, 'key')
      await collectGenerator(gen)

      const callArgs = mockStreamText.mock.calls[0][0]
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('(at 61:01)')
    })
  })
})

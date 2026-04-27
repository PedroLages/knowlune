/**
 * Tests for Q&A from Notes RAG Service
 *
 * Covers: retrieveRelevantNotes, generateQAAnswer, extractCitations
 * Mocks: @/db, @/ai/workers/coordinator, @/lib/vectorSearch, LLM factory
 *
 * After E90-S08, generateQAAnswer uses getLLMClient('noteQA') instead of
 * direct AI SDK calls, so we mock the LLM factory layer.
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

// Mock LLM factory
const mockStreamCompletion = vi.fn()
const mockLLMClient = {
  streamCompletion: mockStreamCompletion,
  getProviderId: () => 'anthropic',
}

vi.mock('@/ai/llm/factory', () => ({
  getLLMClient: vi.fn(async () => mockLLMClient),
  getLLMClientForProvider: vi.fn(() => mockLLMClient),
  withModelFallback: vi.fn(async function* (_feature: string, messages: unknown) {
    for await (const chunk of mockLLMClient.streamCompletion(messages)) {
      if (chunk.content) {
        yield chunk.content
      }
    }
  }),
}))

vi.mock('@/lib/aiConfiguration', () => ({
  resolveFeatureModel: vi.fn(() => ({
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  })),
  getDecryptedApiKeyForProvider: vi.fn(async () => 'mock-api-key'),
}))

// Import after mocks
import { retrieveRelevantNotes, extractCitations, generateQAAnswer } from '../noteQA'
import type { RetrievedNote } from '../noteQA'

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

/** Creates a mock async generator for streamCompletion */
async function* createMockStream(
  chunks: string[]
): AsyncGenerator<{ content: string }, void, unknown> {
  for (const content of chunks) {
    yield { content }
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
      const answer = 'From 001/001-001 and also course 001.'
      const citations = extractCitations(answer, mockNotes)
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
      const gen = generateQAAnswer('question', [])
      const results = await collectGenerator(gen)
      expect(results).toEqual(['No relevant notes found for your question.'])
    })

    it('should stream text chunks from LLM client', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      mockStreamCompletion.mockImplementation(() => createMockStream(['Hello', ' world', '!']))

      const gen = generateQAAnswer('What is React?', notes)
      const results = await collectGenerator(gen)

      expect(results).toEqual(['Hello', ' world', '!'])
    })

    it('should use withModelFallback with noteQA feature', async () => {
      const { withModelFallback } = await import('@/ai/llm/factory')
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('question', notes)
      await collectGenerator(gen)

      expect(withModelFallback).toHaveBeenCalledWith('noteQA', expect.any(Array), undefined)
    })

    it('should include note content in messages passed to streamCompletion', async () => {
      const notes: RetrievedNote[] = [
        makeRetrievedNote({
          content: 'React hooks explanation',
          courseId: '001',
          videoId: '001-001',
        }),
      ]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('Tell me about hooks', notes)
      await collectGenerator(gen)

      expect(mockStreamCompletion).toHaveBeenCalledTimes(1)
      const messages = mockStreamCompletion.mock.calls[0][0]
      const userMessage = messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('React hooks explanation')
      expect(userMessage.content).toContain('001/001-001')
    })

    it('should include timestamp in context when present', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: 125 })]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('question', notes)
      await collectGenerator(gen)

      const messages = mockStreamCompletion.mock.calls[0][0]
      const userMessage = messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('(at 2:05)')
    })

    it('should not include timestamp in context when absent', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: undefined })]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('question', notes)
      await collectGenerator(gen)

      const messages = mockStreamCompletion.mock.calls[0][0]
      const userMessage = messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).not.toContain('(at ')
    })

    it('should format multiple notes separated by dividers', async () => {
      const notes: RetrievedNote[] = [
        makeRetrievedNote({ courseId: '001', videoId: '001-001', content: 'First note' }),
        makeRetrievedNote({ courseId: '002', videoId: '002-001', content: 'Second note' }, 0.8),
      ]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('question', notes)
      await collectGenerator(gen)

      const messages = mockStreamCompletion.mock.calls[0][0]
      const userMessage = messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('[Note 1]')
      expect(userMessage.content).toContain('[Note 2]')
      expect(userMessage.content).toContain('---')
    })

    it('should include system prompt with RAG rules', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('question', notes)
      await collectGenerator(gen)

      const messages = mockStreamCompletion.mock.calls[0][0]
      const systemMessage = messages.find((m: { role: string }) => m.role === 'system')
      expect(systemMessage.content).toContain('study assistant')
      expect(systemMessage.content).toContain('ONLY on the provided notes')
    })

    it('should rethrow non-AbortError exceptions', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]

      mockStreamCompletion.mockImplementation(async function* () {
        yield '' // satisfy require-yield before throwing
        throw new TypeError('Network failure')
      })

      const gen = generateQAAnswer('question', notes)
      await expect(collectGenerator(gen)).rejects.toThrow('Network failure')
    })

    it('should handle empty stream', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote()]
      mockStreamCompletion.mockImplementation(() => createMockStream([]))

      const gen = generateQAAnswer('question', notes)
      const results = await collectGenerator(gen)
      expect(results).toEqual([])
    })

    it('should format timestamp 3661 seconds as 61:01', async () => {
      const notes: RetrievedNote[] = [makeRetrievedNote({ timestamp: 3661 })]
      mockStreamCompletion.mockImplementation(() => createMockStream(['answer']))

      const gen = generateQAAnswer('question', notes)
      await collectGenerator(gen)

      const messages = mockStreamCompletion.mock.calls[0][0]
      const userMessage = messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toContain('(at 61:01)')
    })
  })
})

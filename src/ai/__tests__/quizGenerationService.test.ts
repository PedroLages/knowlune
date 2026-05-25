/**
 * Unit Tests: quizGenerationService.ts
 *
 * Tests the 4-stage quiz generation pipeline with factory-level mocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

// --- Hoisted mocks ---

const {
  mockTranscriptFirst,
  mockQuizzesWhere,
  mockQuizzesPut,
  mockChaptersSortBy,
  mockDigest,
  mockSyncableWrite,
  mockResolveFeatureModel,
  mockGetOllamaServerUrl,
  mockGetOllamaSelectedModel,
  mockStreamCompletion,
  mockAssertAIFeatureConsent,
  mockGetLLMClient,
  mockIsFeatureEnabled,
} = vi.hoisted(() => ({
  mockTranscriptFirst: vi.fn(),
  mockQuizzesWhere: vi.fn(),
  mockQuizzesPut: vi.fn(),
  mockChaptersSortBy: vi.fn(),
  mockDigest: vi.fn(),
  mockSyncableWrite: vi.fn(),
  mockResolveFeatureModel: vi.fn(() => ({
    provider: 'anthropic' as const,
    model: 'claude-haiku-4-5',
  })),
  mockGetOllamaServerUrl: vi.fn(() => null),
  mockGetOllamaSelectedModel: vi.fn(() => null),
  mockStreamCompletion: vi.fn(),
  mockAssertAIFeatureConsent: vi.fn(async () => {}),
  mockGetLLMClient: vi.fn(),
  mockIsFeatureEnabled: vi.fn(() => true),
}))

vi.mock('@/lib/aiConfiguration', () => ({
  resolveFeatureModel: mockResolveFeatureModel,
  getOllamaServerUrl: mockGetOllamaServerUrl,
  getOllamaSelectedModel: mockGetOllamaSelectedModel,
  isFeatureEnabled: mockIsFeatureEnabled,
}))

vi.mock('@/ai/llm/factory', () => ({
  getLLMClient: mockGetLLMClient,
  assertAIFeatureConsent: mockAssertAIFeatureConsent,
}))

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: mockSyncableWrite,
}))

vi.mock('@/db/schema', () => ({
  db: {
    youtubeTranscripts: {
      where: () => ({
        equals: () => ({
          first: mockTranscriptFirst,
        }),
      }),
    },
    youtubeChapters: {
      where: () => ({
        equals: () => ({
          sortBy: mockChaptersSortBy,
        }),
      }),
    },
    quizzes: {
      where: () => ({
        equals: () => ({
          toArray: mockQuizzesWhere,
        }),
      }),
      put: mockQuizzesPut,
    },
  },
}))

vi.stubGlobal('crypto', {
  subtle: { digest: mockDigest },
  randomUUID: () => 'test-uuid-1234',
})

import { generateQuizForLesson } from '../quizGenerationService'
import { ConsentError } from '@/ai/lib/ConsentError'
import { LLMError } from '@/ai/llm/types'

// --- Test Helpers ---

/** Creates an async generator that yields stream chunks */
async function* createMockStream(
  chunks: string[]
): AsyncGenerator<{ content: string; finishReason?: 'stop' | 'length' }, void, unknown> {
  for (const content of chunks) {
    yield { content }
  }
}

/** Reset all mock implementations to default working state */
function resetMockDefaults() {
  mockDigest.mockImplementation(async () => new ArrayBuffer(32))
  mockResolveFeatureModel.mockReturnValue({
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  })
  mockGetOllamaServerUrl.mockReturnValue(null)
  mockGetOllamaSelectedModel.mockReturnValue(null)
  mockAssertAIFeatureConsent.mockResolvedValue(undefined)
  mockGetLLMClient.mockImplementation(async () => ({
    streamCompletion: mockStreamCompletion,
    getProviderId: () => 'anthropic',
  }))
  mockStreamCompletion.mockReset()
  mockIsFeatureEnabled.mockReturnValue(true)
}

function configureAIProvider(provider: 'anthropic' | 'ollama' = 'anthropic') {
  if (provider === 'ollama') {
    mockResolveFeatureModel.mockReturnValue({
      provider: 'ollama',
      model: 'llama3.2',
    })
    mockGetOllamaServerUrl.mockReturnValue('http://localhost:11434')
    mockGetOllamaSelectedModel.mockReturnValue('llama3.2')
  } else {
    mockResolveFeatureModel.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })
    mockGetOllamaServerUrl.mockReturnValue(null)
    mockGetOllamaSelectedModel.mockReturnValue(null)
  }
}

function mockTranscript(
  fullText = 'The React library uses a virtual DOM for efficient rendering of UI components on the web.'
) {
  const words = fullText.split(' ')
  const cues = []
  for (let i = 0; i < words.length; i += 5) {
    cues.push({
      startTime: i * 2,
      endTime: (i + 5) * 2,
      text: words.slice(i, i + 5).join(' '),
    })
  }
  mockTranscriptFirst.mockResolvedValue({
    status: 'done',
    cues,
    fullText,
  })
}

/** Set up mock stream that yields valid quiz JSON for cloud provider tests */
function mockValidStreamResponse() {
  mockStreamCompletion.mockReturnValue(
    createMockStream([
      JSON.stringify({
        questions: [
          {
            text: 'What is word0 related to in the context of word1?',
            type: 'multiple-choice',
            options: ['word2', 'word3', 'word4', 'word5'],
            correctAnswer: 'word2',
            explanation: 'word0 and word1 are key terms.',
            bloomsLevel: 'remember',
          },
          {
            text: 'Is word6 a type of word7?',
            type: 'true-false',
            options: ['True', 'False'],
            correctAnswer: 'True',
            explanation: 'word6 is indeed a type of word7.',
            bloomsLevel: 'remember',
          },
        ],
      }),
    ])
  )
}

/** Set up mock fetch for Ollama native API path */
function mockValidOllamaNativeResponse() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          message: {
            content: JSON.stringify({
              questions: [
                {
                  text: 'What is word0 related to in the context of word1?',
                  type: 'multiple-choice',
                  options: ['word2', 'word3', 'word4', 'word5'],
                  correctAnswer: 'word2',
                  explanation: 'word0 and word1 are key terms.',
                  bloomsLevel: 'remember',
                },
                {
                  text: 'Is word6 a type of word7?',
                  type: 'true-false',
                  options: ['True', 'False'],
                  correctAnswer: 'True',
                  explanation: 'word6 is indeed a type of word7.',
                  bloomsLevel: 'remember',
                },
              ],
            }),
          },
        }),
    })
  )
}

beforeEach(() => {
  // Re-apply global crypto stub (afterEach unstubs all globals)
  vi.stubGlobal('crypto', {
    subtle: { digest: mockDigest },
    randomUUID: () => 'test-uuid-1234',
  })
  vi.clearAllMocks()
  resetMockDefaults()
  mockQuizzesWhere.mockResolvedValue([])
  mockQuizzesPut.mockResolvedValue(undefined)
  mockChaptersSortBy.mockResolvedValue([])

  // E96-S02: forward syncableWrite('quizzes', 'put', quiz) calls onto
  // mockQuizzesPut(quiz) so existing assertions on the stored payload keep
  // working without rewriting each test.
  mockSyncableWrite.mockImplementation(
    async (table: string, operation: string, record: unknown) => {
      if (table === 'quizzes' && (operation === 'put' || operation === 'add')) {
        await mockQuizzesPut(record)
      }
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateQuizForLesson', () => {
  it('returns error when consent is not granted (ConsentError)', async () => {
    mockAssertAIFeatureConsent.mockRejectedValue(new ConsentError('ai_tutor'))
    configureAIProvider('anthropic')

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('Settings')
  })

  it('returns error when AI provider is not configured (AUTH_ERROR)', async () => {
    mockGetLLMClient.mockRejectedValue(
      new LLMError('No API key configured', 'AUTH_ERROR', 'anthropic')
    )
    configureAIProvider('anthropic')

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('not configured')
  })

  it('returns error when no transcript found', async () => {
    configureAIProvider('anthropic')
    mockTranscriptFirst.mockResolvedValue(null)

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('transcript')
  })

  it('returns cached quiz when transcriptHash matches', async () => {
    configureAIProvider('anthropic')
    mockTranscript()

    const expectedHash = Array.from(new Uint8Array(new ArrayBuffer(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const cachedQuiz = {
      id: 'cached-quiz',
      lessonId: 'vid1',
      transcriptHash: expectedHash,
      questions: [
        {
          id: 'q1',
          text: 'Q?',
          type: 'true-false',
          correctAnswer: 'True',
          explanation: '',
          points: 1,
          order: 1,
        },
      ],
    }
    mockQuizzesWhere.mockImplementation(() => Promise.resolve([cachedQuiz]))

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.cached).toBe(true)
    expect(result.quiz).toBeTruthy()
    expect(result.error).toBeUndefined()
    expect(mockStreamCompletion).not.toHaveBeenCalled()
  })

  it('generates quiz via LLM factory for cloud provider', async () => {
    configureAIProvider('anthropic')
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)
    mockValidStreamResponse()

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeTruthy()
    expect(result.cached).toBe(false)
    expect(result.quiz!.questions.length).toBeGreaterThan(0)
    expect(mockQuizzesPut).toHaveBeenCalledTimes(1)
  })

  it('generates quiz via Ollama native API path', async () => {
    configureAIProvider('ollama')
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)
    mockValidOllamaNativeResponse()

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeTruthy()
    expect(result.cached).toBe(false)
    expect(result.quiz!.questions.length).toBeGreaterThan(0)
    expect(mockQuizzesPut).toHaveBeenCalledTimes(1)
  })

  it('retries on LLM validation failure', async () => {
    configureAIProvider('anthropic')
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)

    // First call returns invalid JSON, second returns valid
    mockStreamCompletion
      .mockReturnValueOnce(createMockStream(['{"invalid": true}']))
      .mockReturnValueOnce(
        createMockStream([
          JSON.stringify({
            questions: [
              {
                text: 'Q1?',
                type: 'true-false',
                options: ['True', 'False'],
                correctAnswer: 'True',
                explanation: 'Explanation.',
                bloomsLevel: 'remember',
              },
            ],
          }),
        ])
      )

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeTruthy()
    expect(mockStreamCompletion).toHaveBeenCalledTimes(2)
  })

  it('returns error when all retries fail', async () => {
    configureAIProvider('anthropic')
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)

    mockStreamCompletion.mockReturnValue(createMockStream(['not json']))

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('failed')
  })

  it('respects bloom level option', async () => {
    configureAIProvider('anthropic')
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)
    mockValidStreamResponse()

    await generateQuizForLesson('vid1', 'course1', { bloomsLevel: 'apply' })

    // Check that the stream was called with a prompt containing 'apply'
    const streamCall = mockStreamCompletion.mock.calls[0]
    const messages = streamCall[0]
    expect(messages[0].content).toContain('apply')
  })
})

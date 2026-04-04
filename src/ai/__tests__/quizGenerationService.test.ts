/**
 * Unit Tests: quizGenerationService.ts
 *
 * Tests the 4-stage quiz generation pipeline with mocked Ollama and Dexie.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// --- Hoisted mocks ---

const {
  mockTranscriptFirst,
  mockQuizzesWhere,
  mockQuizzesPut,
  mockChaptersSortBy,
  mockFetch,
  mockDigest,
} = vi.hoisted(() => ({
  mockTranscriptFirst: vi.fn(),
  mockQuizzesWhere: vi.fn(),
  mockQuizzesPut: vi.fn(),
  mockChaptersSortBy: vi.fn(),
  mockFetch: vi.fn(),
  mockDigest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
}))

vi.mock('@/lib/aiConfiguration', () => ({
  getOllamaServerUrl: vi.fn(),
  getOllamaSelectedModel: vi.fn(),
  isOllamaDirectConnection: vi.fn(() => false),
  isFeatureEnabled: vi.fn(() => true),
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

vi.stubGlobal('fetch', mockFetch)

import { generateQuizForLesson } from '../quizGenerationService'
import {
  getOllamaServerUrl,
  getOllamaSelectedModel,
  isFeatureEnabled,
} from '@/lib/aiConfiguration'

// --- Test Helpers ---

function configureOllama() {
  ;(getOllamaServerUrl as Mock).mockReturnValue('http://localhost:11434')
  ;(getOllamaSelectedModel as Mock).mockReturnValue('llama3.2')
  ;(isFeatureEnabled as Mock).mockReturnValue(true)
}

function mockTranscript(fullText = 'The React library uses a virtual DOM for efficient rendering of UI components on the web.') {
  const words = fullText.split(' ')
  // Create enough cues to make a valid chunk
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

function mockValidLLMResponse() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        message: {
          content: JSON.stringify({
            questions: [
              {
                text: 'What does React use for efficient rendering?',
                type: 'multiple-choice',
                options: ['Virtual DOM', 'Shadow DOM', 'Real DOM', 'None'],
                correctAnswer: 'Virtual DOM',
                explanation: 'React uses a virtual DOM.',
                bloomsLevel: 'remember',
              },
              {
                text: 'React is a framework.',
                type: 'true-false',
                options: ['True', 'False'],
                correctAnswer: 'False',
                explanation: 'React is a library.',
                bloomsLevel: 'remember',
              },
            ],
          }),
        },
      }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuizzesWhere.mockResolvedValue([])
  mockQuizzesPut.mockResolvedValue(undefined)
  mockChaptersSortBy.mockResolvedValue([])
})

describe('generateQuizForLesson', () => {
  it('returns error when AI consent is not given', async () => {
    ;(isFeatureEnabled as Mock).mockReturnValue(false)
    configureOllama()
    ;(isFeatureEnabled as Mock).mockReturnValue(false)

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('consent')
  })

  it('returns error when Ollama is not configured', async () => {
    ;(isFeatureEnabled as Mock).mockReturnValue(true)
    ;(getOllamaServerUrl as Mock).mockReturnValue(null)

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('not configured')
  })

  it('returns error when no transcript found', async () => {
    configureOllama()
    mockTranscriptFirst.mockResolvedValue(null)

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('transcript')
  })

  it('returns cached quiz when transcriptHash matches', async () => {
    configureOllama()
    mockTranscript()

    const cachedQuiz = {
      id: 'cached-quiz',
      lessonId: 'vid1',
      transcriptHash: '0'.repeat(64), // SHA-256 of zeroed buffer
      questions: [{ id: 'q1', text: 'Q?', type: 'true-false', correctAnswer: 'True', explanation: '', points: 1, order: 1 }],
    }
    mockQuizzesWhere.mockResolvedValue([cachedQuiz])

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.cached).toBe(true)
    expect(result.quiz).toBeTruthy()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('generates quiz via LLM when no cache hit', async () => {
    configureOllama()
    // Need enough words for a chunk (minimum ~250 words)
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)
    mockValidLLMResponse()

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeTruthy()
    expect(result.cached).toBe(false)
    expect(result.quiz!.questions.length).toBeGreaterThan(0)
    expect(mockQuizzesPut).toHaveBeenCalledTimes(1)
  })

  it('retries on LLM validation failure', async () => {
    configureOllama()
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)

    // First call returns invalid JSON, second returns valid
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { content: '{"invalid": true}' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: {
              content: JSON.stringify({
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
            },
          }),
      })

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeTruthy()
    expect(mockFetch).toHaveBeenCalledTimes(2) // 1 fail + 1 success
  })

  it('returns error when all retries fail', async () => {
    configureOllama()
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)

    // All calls return invalid JSON
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: { content: 'not json' } }),
    })

    const result = await generateQuizForLesson('vid1', 'course1')
    expect(result.quiz).toBeNull()
    expect(result.error).toContain('failed')
  })

  it('respects bloom level option', async () => {
    configureOllama()
    const longText = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')
    mockTranscript(longText)
    mockValidLLMResponse()

    await generateQuizForLesson('vid1', 'course1', { bloomsLevel: 'apply' })

    // Check that the fetch was called with a prompt containing 'apply'
    const fetchCall = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.messages[0].content).toContain('apply')
  })
})

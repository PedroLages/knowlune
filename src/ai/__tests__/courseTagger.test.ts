/**
 * Unit Tests: courseTagger.ts
 *
 * Tests Ollama-powered course auto-categorization.
 * Covers: tag generation, response parsing, error handling, graceful degradation.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'

// --- Mocks (before imports) ---

vi.mock('@/lib/aiConfiguration', () => ({
  getOllamaServerUrl: vi.fn(),
  getOllamaSelectedModel: vi.fn(),
  isOllamaDirectConnection: vi.fn(() => false),
}))

// --- Import SUT + mocked modules ---

import { generateCourseTags, parseTagResponse, isOllamaTaggingAvailable } from '../courseTagger'
import {
  getOllamaServerUrl,
  getOllamaSelectedModel,
  isOllamaDirectConnection,
} from '@/lib/aiConfiguration'

// --- Test Helpers ---

function mockOllamaConfigured(serverUrl = 'http://192.168.2.200:11434', model = 'llama3.2:latest') {
  ;(getOllamaServerUrl as Mock).mockReturnValue(serverUrl)
  ;(getOllamaSelectedModel as Mock).mockReturnValue(model)
  ;(isOllamaDirectConnection as Mock).mockReturnValue(false)
}

function mockOllamaNotConfigured() {
  ;(getOllamaServerUrl as Mock).mockReturnValue(null)
  ;(getOllamaSelectedModel as Mock).mockReturnValue(null)
}

function mockFetchSuccess(tags: string[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        message: { content: JSON.stringify({ tags }) },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  )
}

const courseMetadata = {
  title: 'Introduction to Machine Learning',
  fileNames: ['01-overview.mp4', '02-linear-regression.mp4', 'syllabus.pdf'],
}

// --- Tests ---

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateCourseTags', () => {
  it('returns tags from Ollama when configured (routes through proxy)', async () => {
    mockOllamaConfigured()
    mockFetchSuccess(['machine learning', 'python', 'data science'])

    const result = await generateCourseTags(courseMetadata)

    expect(result.tags).toEqual(['machine learning', 'python', 'data science'])
    expect(fetch).toHaveBeenCalledOnce()
    // Should route through the Express proxy, not directly to Ollama
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/ollama/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    // Proxy request should include ollamaServerUrl in body
    const callBody = JSON.parse((fetch as Mock).mock.calls[0][1].body)
    expect(callBody.ollamaServerUrl).toBe('http://192.168.2.200:11434')
  })

  it('routes directly to Ollama when direct connection is enabled', async () => {
    mockOllamaConfigured()
    ;(isOllamaDirectConnection as Mock).mockReturnValue(true)
    mockFetchSuccess(['machine learning', 'python'])

    const result = await generateCourseTags(courseMetadata)

    expect(result.tags).toEqual(['machine learning', 'python'])
    expect(fetch).toHaveBeenCalledWith(
      'http://192.168.2.200:11434/api/chat',
      expect.objectContaining({ method: 'POST' })
    )
    // Direct mode should NOT include ollamaServerUrl in body
    const callBody = JSON.parse((fetch as Mock).mock.calls[0][1].body)
    expect(callBody.ollamaServerUrl).toBeUndefined()
  })

  it('sends correct request body with model, format, and prompt', async () => {
    mockOllamaConfigured('http://192.168.2.200:11434', 'phi3:mini')
    mockFetchSuccess(['python'])

    await generateCourseTags(courseMetadata)

    const callBody = JSON.parse((fetch as Mock).mock.calls[0][1].body)
    expect(callBody.model).toBe('phi3:mini')
    expect(callBody.stream).toBe(false)
    expect(callBody.format).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          tags: expect.objectContaining({ type: 'array' }),
        }),
      })
    )
    expect(callBody.messages[1].content).toContain('Introduction to Machine Learning')
    expect(callBody.messages[1].content).toContain('01-overview.mp4')
    // In proxy mode, ollamaServerUrl should be included
    expect(callBody.ollamaServerUrl).toBe('http://192.168.2.200:11434')
  })

  it('returns empty tags when Ollama is not configured (AC4)', async () => {
    mockOllamaNotConfigured()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await generateCourseTags(courseMetadata)

    expect(result.tags).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns empty tags on network error', async () => {
    mockOllamaConfigured()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await generateCourseTags(courseMetadata)

    expect(result.tags).toEqual([])
  })

  it('returns empty tags on HTTP error', async () => {
    mockOllamaConfigured()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Model not found', { status: 404 })
    )

    const result = await generateCourseTags(courseMetadata)

    expect(result.tags).toEqual([])
  })

  it('returns empty tags on timeout (AbortError)', async () => {
    mockOllamaConfigured()
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError)

    const result = await generateCourseTags(courseMetadata)

    expect(result.tags).toEqual([])
  })

  it('limits file names to 50', async () => {
    mockOllamaConfigured()
    mockFetchSuccess(['bulk course'])

    const manyFiles = Array.from({ length: 100 }, (_, i) => `file-${i}.mp4`)
    await generateCourseTags({ title: 'Bulk Course', fileNames: manyFiles })

    const callBody = JSON.parse((fetch as Mock).mock.calls[0][1].body)
    const filesInPrompt = callBody.messages[1].content
    // Should contain file-49 but not file-50
    expect(filesInPrompt).toContain('file-49.mp4')
    expect(filesInPrompt).not.toContain('file-50.mp4')
  })

  it('handles empty file list gracefully', async () => {
    mockOllamaConfigured()
    mockFetchSuccess(['programming'])

    const result = await generateCourseTags({ title: 'Just a Title', fileNames: [] })

    expect(result.tags).toEqual(['programming'])
    const callBody = JSON.parse((fetch as Mock).mock.calls[0][1].body)
    expect(callBody.messages[1].content).toContain('(none)')
  })

  it('respects external abort signal', async () => {
    mockOllamaConfigured()
    const controller = new AbortController()
    controller.abort()

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError')
    )

    const result = await generateCourseTags(courseMetadata, controller.signal)

    expect(result.tags).toEqual([])
  })

  it('defaults to llama3.2 when no model is selected', async () => {
    ;(getOllamaServerUrl as Mock).mockReturnValue('http://localhost:11434')
    ;(getOllamaSelectedModel as Mock).mockReturnValue(null)
    mockFetchSuccess(['python'])

    await generateCourseTags(courseMetadata)

    const callBody = JSON.parse((fetch as Mock).mock.calls[0][1].body)
    expect(callBody.model).toBe('llama3.2')
  })
})

describe('parseTagResponse', () => {
  it('parses valid JSON object with tags array', () => {
    expect(parseTagResponse('{"tags": ["Python", "ML"]}')).toEqual(['python', 'ml'])
  })

  it('parses raw JSON array', () => {
    expect(parseTagResponse('["Python", "Data Science"]')).toEqual(['python', 'data science'])
  })

  it('handles markdown code fences', () => {
    const response = '```json\n{"tags": ["React", "TypeScript"]}\n```'
    expect(parseTagResponse(response)).toEqual(['react', 'typescript'])
  })

  it('handles code fences without language tag', () => {
    const response = '```\n{"tags": ["Web Dev"]}\n```'
    expect(parseTagResponse(response)).toEqual(['web dev'])
  })

  it('extracts JSON from surrounding text', () => {
    const response = 'Here are the tags: {"tags": ["Docker", "DevOps"]} Hope that helps!'
    expect(parseTagResponse(response)).toEqual(['docker', 'devops'])
  })

  it('normalizes to lowercase and trims', () => {
    expect(parseTagResponse('{"tags": ["  Python ", "REACT", "  ML  "]}')).toEqual([
      'python',
      'react',
      'ml',
    ])
  })

  it('deduplicates tags', () => {
    expect(parseTagResponse('{"tags": ["Python", "python", "PYTHON"]}')).toEqual(['python'])
  })

  it('limits to 5 tags', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(parseTagResponse(JSON.stringify({ tags }))).toHaveLength(5)
  })

  it('filters non-string values', () => {
    expect(parseTagResponse('{"tags": ["Python", 42, null, true, "ML"]}')).toEqual(['python', 'ml'])
  })

  it('filters empty strings', () => {
    expect(parseTagResponse('{"tags": ["Python", "", "  ", "ML"]}')).toEqual(['python', 'ml'])
  })

  it('returns empty array for undefined input', () => {
    expect(parseTagResponse(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseTagResponse('')).toEqual([])
  })

  it('returns empty array for garbage text', () => {
    expect(parseTagResponse('This is not JSON at all')).toEqual([])
  })

  it('returns empty array for malformed JSON', () => {
    expect(parseTagResponse('{tags: [broken}')).toEqual([])
  })
})

describe('isOllamaTaggingAvailable', () => {
  it('returns true when Ollama is configured', () => {
    mockOllamaConfigured()
    expect(isOllamaTaggingAvailable()).toBe(true)
  })

  it('returns false when Ollama is not configured', () => {
    mockOllamaNotConfigured()
    expect(isOllamaTaggingAvailable()).toBe(false)
  })
})

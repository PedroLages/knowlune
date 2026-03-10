# Epic 9 AI Testing Strategy

**Date:** 2026-03-10
**Epic:** Epic 9 - AI-Powered Learning Assistant
**Scope:** Testing patterns for embeddings, vector search, LLM inference, Web Workers
**Status:** Ready for implementation

---

## Executive Summary

This document establishes deterministic testing patterns for Epic 9's AI features:
- **Video summaries** (LLM inference)
- **Q&A from notes** (embeddings + vector search + LLM)
- **Smart note suggestions** (semantic analysis)
- **AI-curated learning paths** (content recommendations)

**Key Challenges:**
- AI responses are non-deterministic by nature
- Large model downloads (664MB-1.3GB) cannot run in CI
- Web Workers require special test patterns
- Vector search needs seeded embeddings for consistency

**Solution Approach:**
- **E2E tests**: Mock LLM responses at Web Worker boundary
- **Unit tests**: Test vector math, embedding generation, search algorithms
- **Integration tests**: Test worker communication, state synchronization
- **Performance tests**: Benchmark inference time, memory usage (local only)

---

## 1. Testing Architecture Overview

### 1.1 Test Pyramid for AI Features

```
┌─────────────────────────────────────────────────┐
│ E2E Tests (Playwright)                          │
│ - Mock LLM responses at worker boundary         │
│ - Test UI interactions (summary display, Q&A)   │
│ - Validate error handling, loading states       │
│ - Chromium only, local execution                │
└─────────────────────────────────────────────────┘
              ▲
              │
┌─────────────────────────────────────────────────┐
│ Integration Tests (Vitest)                      │
│ - Test worker message passing                   │
│ - Validate embedding pipeline                   │
│ - Test vector store integration                 │
│ - Verify IndexedDB seeding/retrieval            │
└─────────────────────────────────────────────────┘
              ▲
              │
┌─────────────────────────────────────────────────┐
│ Unit Tests (Vitest)                             │
│ - Vector math (cosine similarity, etc.)         │
│ - Embedding normalization                       │
│ - Search algorithms (top-k, filtering)          │
│ - Pure functions, no side effects               │
└─────────────────────────────────────────────────┘
```

### 1.2 Test Scopes

| Test Type | What to Test | Tool | Environment |
|-----------|-------------|------|-------------|
| **Unit** | Vector math, search algorithms, data transformations | Vitest | Local + CI |
| **Integration** | Worker communication, IndexedDB, embedding pipeline | Vitest | Local + CI |
| **E2E** | Full user flows with mocked AI responses | Playwright | Local only |
| **Performance** | Inference latency, memory footprint | Playwright + Custom | Local only |

**CI Exclusion:** E2E AI tests run **local only** (no WebGPU in CI headless browsers).

---

## 2. Deterministic Testing Patterns

### 2.1 Fixed Embeddings for Vector Search

**Problem:** Embedding models produce slightly different outputs per run.

**Solution:** Pre-generate fixed embeddings for test data, seed in IndexedDB.

#### Pattern: Fixed Embedding Factory

```typescript
// tests/support/fixtures/factories/embedding-factory.ts
import { FIXED_TIMESTAMP } from '../../../utils/test-time'

/**
 * Pre-computed embedding vectors for deterministic tests.
 * Generated once from "Introduction to React" text via Llama 3.2 1B.
 */
export const FIXED_EMBEDDINGS = {
  'react-intro': new Float32Array([
    0.23, -0.45, 0.12, 0.89, -0.34, 0.67, -0.21, 0.56,
    // ... 384 dimensions total for Llama 3.2 1B
  ]),
  'state-management': new Float32Array([
    0.12, -0.33, 0.45, 0.78, -0.23, 0.56, -0.11, 0.89,
    // ... 384 dimensions
  ]),
  'hooks-tutorial': new Float32Array([
    0.34, -0.12, 0.23, 0.67, -0.45, 0.34, -0.56, 0.78,
    // ... 384 dimensions
  ]),
} as const

export interface NoteWithEmbedding {
  id: string
  courseId: string
  videoId: string
  content: string
  embedding: Float32Array
  createdAt: string
  updatedAt: string
}

export function createNoteWithEmbedding(
  overrides: Partial<NoteWithEmbedding> = {}
): NoteWithEmbedding {
  const now = new Date(FIXED_TIMESTAMP).toISOString()
  return {
    id: crypto.randomUUID(),
    courseId: 'course-1',
    videoId: 'lesson-1',
    content: 'Introduction to React hooks and state management.',
    embedding: FIXED_EMBEDDINGS['react-intro'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createEmbeddingBatch(count: number): NoteWithEmbedding[] {
  const embeddings = Object.values(FIXED_EMBEDDINGS)
  return Array.from({ length: count }, (_, i) => {
    const embeddingKey = Object.keys(FIXED_EMBEDDINGS)[i % embeddings.length]
    return createNoteWithEmbedding({
      id: `note-${i + 1}`,
      content: `Test note content ${i + 1}`,
      embedding: FIXED_EMBEDDINGS[embeddingKey as keyof typeof FIXED_EMBEDDINGS],
    })
  })
}
```

#### Pattern: Seeding Embeddings in IndexedDB

```typescript
// tests/support/helpers/ai-seed.ts
import type { Page } from '@playwright/test'
import { seedIndexedDBStore } from './indexeddb-seed'
import type { NoteWithEmbedding } from '../fixtures/factories/embedding-factory'

/**
 * Seeds notes with pre-computed embeddings into IndexedDB.
 * Uses shared seedIndexedDBStore with frame-accurate waits.
 */
export async function seedNotesWithEmbeddings(
  page: Page,
  notes: NoteWithEmbedding[]
): Promise<void> {
  // Convert Float32Array to regular array for JSON serialization
  const serializedNotes = notes.map(note => ({
    ...note,
    embedding: Array.from(note.embedding), // JSON-serializable
  }))

  await seedIndexedDBStore(page, 'ElearningDB', 'notes', serializedNotes)
}

/**
 * Seeds video summaries (AI-generated content) into IndexedDB.
 */
export interface VideoSummary {
  id: string
  videoId: string
  summary: string
  keyPoints: string[]
  generatedAt: string
}

export async function seedVideoSummaries(
  page: Page,
  summaries: VideoSummary[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'videoSummaries', summaries)
}

/**
 * Seeds learning path recommendations into IndexedDB.
 */
export interface LearningPath {
  id: string
  userId: string
  recommendations: Array<{
    courseId: string
    lessonId: string
    reason: string
    confidence: number
  }>
  generatedAt: string
}

export async function seedLearningPaths(
  page: Page,
  paths: LearningPath[]
): Promise<void> {
  await seedIndexedDBStore(page, 'ElearningDB', 'learningPaths', paths)
}
```

#### Example: E2E Test with Fixed Embeddings

```typescript
// tests/e2e/story-e09-s02-qa-from-notes.spec.ts
import { test, expect } from '@playwright/test'
import { FIXED_DATE } from '../utils/test-time'
import { createNoteWithEmbedding, FIXED_EMBEDDINGS } from '../support/fixtures/factories/embedding-factory'
import { seedNotesWithEmbeddings } from '../support/helpers/ai-seed'

test.describe('Story E09-S02: Q&A from Notes', () => {
  test('user searches notes and gets relevant results', async ({ page }) => {
    // Seed 3 notes with fixed embeddings
    const notes = [
      createNoteWithEmbedding({
        id: 'note-1',
        content: 'React hooks allow functional components to have state.',
        embedding: FIXED_EMBEDDINGS['react-intro'],
      }),
      createNoteWithEmbedding({
        id: 'note-2',
        content: 'State management with Redux and Zustand.',
        embedding: FIXED_EMBEDDINGS['state-management'],
      }),
      createNoteWithEmbedding({
        id: 'note-3',
        content: 'Using useEffect and useState hooks.',
        embedding: FIXED_EMBEDDINGS['hooks-tutorial'],
      }),
    ]

    await seedNotesWithEmbeddings(page, notes)

    await page.goto('/ai-assistant')

    // User asks a question (search query)
    await page.getByPlaceholder('Ask about your notes...').fill('How do React hooks work?')
    await page.getByRole('button', { name: 'Search' }).click()

    // Deterministic: Fixed embeddings ensure consistent search results
    // Expected: note-1 and note-3 have higher similarity to query than note-2
    await expect(page.getByTestId('search-result-note-1')).toBeVisible()
    await expect(page.getByTestId('search-result-note-3')).toBeVisible()
    await expect(page.getByText('React hooks allow functional components')).toBeVisible()
  })
})
```

**Key Points:**
- Fixed embeddings eliminate non-determinism
- Search results are consistent across test runs
- No LLM inference needed for search (just cosine similarity)

---

### 2.2 Mocking LLM Responses at Worker Boundary

**Problem:** LLM inference is non-deterministic and requires WebGPU (unavailable in CI).

**Solution:** Mock worker responses at the message-passing boundary.

#### Pattern: Worker Message Mocking

```typescript
// tests/support/helpers/ai-worker-mock.ts
import type { Page } from '@playwright/test'

export interface MockLLMResponse {
  type: 'summary' | 'question-answer' | 'suggestion'
  input: string
  output: string
}

/**
 * Intercepts Web Worker messages and returns mocked AI responses.
 * Works by injecting a script that overrides Worker postMessage.
 */
export async function mockAIWorkerResponses(
  page: Page,
  responses: MockLLMResponse[]
): Promise<void> {
  await page.addInitScript(
    ({ mockResponses }) => {
      // Store original Worker constructor
      const OriginalWorker = window.Worker

      // Override Worker constructor
      window.Worker = class extends OriginalWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
          super(scriptURL, options)

          // Intercept postMessage to worker
          const originalPostMessage = this.postMessage.bind(this)
          this.postMessage = (message: any) => {
            // Check if this message matches a mock
            const mock = mockResponses.find(
              (m: MockLLMResponse) =>
                message.type === m.type && message.input === m.input
            )

            if (mock) {
              // Send mocked response after short delay (simulate inference time)
              setTimeout(() => {
                this.dispatchEvent(
                  new MessageEvent('message', {
                    data: {
                      type: message.type,
                      result: mock.output,
                      success: true,
                    },
                  })
                )
              }, 100)
            } else {
              // No mock found, pass through to real worker
              originalPostMessage(message)
            }
          }
        }
      } as any
    },
    { mockResponses: responses }
  )
}
```

#### Example: E2E Test with Mocked LLM

```typescript
// tests/e2e/story-e09-s01-video-summaries.spec.ts
import { test, expect } from '@playwright/test'
import { mockAIWorkerResponses } from '../support/helpers/ai-worker-mock'

test.describe('Story E09-S01: AI Video Summaries', () => {
  test('user generates summary for video', async ({ page }) => {
    // Mock LLM response for summary generation
    await mockAIWorkerResponses(page, [
      {
        type: 'summary',
        input: 'Transcript: Introduction to React hooks...',
        output: 'React hooks allow functional components to use state and lifecycle features. Key concepts: useState, useEffect, custom hooks.',
      },
    ])

    await page.goto('/courses/react-101/lesson-1')

    // Click "Generate Summary" button
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Wait for loading state
    await expect(page.getByTestId('summary-loading')).toBeVisible()

    // Worker returns mocked response
    await expect(page.getByTestId('summary-loading')).toBeHidden({ timeout: 5000 })

    // Verify mocked summary appears
    await expect(page.getByText('React hooks allow functional components')).toBeVisible()
    await expect(page.getByText('Key concepts: useState, useEffect')).toBeVisible()
  })

  test('handles LLM failure gracefully', async ({ page }) => {
    // Mock worker failure
    await page.addInitScript(() => {
      const OriginalWorker = window.Worker
      window.Worker = class extends OriginalWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
          super(scriptURL, options)
          const originalPostMessage = this.postMessage.bind(this)
          this.postMessage = (message: any) => {
            // Simulate worker error
            setTimeout(() => {
              this.dispatchEvent(
                new MessageEvent('message', {
                  data: {
                    type: message.type,
                    error: 'Model failed to load',
                    success: false,
                  },
                })
              )
            }, 100)
          }
        }
      } as any
    })

    await page.goto('/courses/react-101/lesson-1')
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Error message appears
    await expect(page.getByText('Failed to generate summary')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})
```

**Key Points:**
- Mocks LLM at worker boundary (not at application code level)
- Simulates inference latency (100ms delay)
- Tests both success and failure paths
- Works in CI (no WebGPU required)

---

### 2.3 Testing Web Worker Communication

**Problem:** Web Workers run in separate threads, harder to test.

**Solution:** Test message passing contracts with integration tests.

#### Pattern: Worker Contract Testing (Vitest)

```typescript
// src/workers/__tests__/ai-worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIWorker } from '../ai-worker'

// Mock WebLLM (no actual model loading in tests)
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: 'Mocked summary response' } }],
        })),
      },
    },
  })),
}))

describe('AIWorker Message Contracts', () => {
  let worker: AIWorker

  beforeEach(() => {
    worker = new AIWorker()
  })

  it('should respond to summary request', async () => {
    const request = {
      type: 'summary',
      input: 'Video transcript here...',
      requestId: 'req-1',
    }

    const response = await worker.handleMessage(request)

    expect(response).toMatchObject({
      type: 'summary',
      requestId: 'req-1',
      success: true,
      result: expect.any(String),
    })
  })

  it('should respond to question-answer request', async () => {
    const request = {
      type: 'question-answer',
      input: 'How do React hooks work?',
      context: ['Note 1 content', 'Note 2 content'],
      requestId: 'req-2',
    }

    const response = await worker.handleMessage(request)

    expect(response).toMatchObject({
      type: 'question-answer',
      requestId: 'req-2',
      success: true,
      result: expect.any(String),
    })
  })

  it('should handle invalid message type', async () => {
    const request = {
      type: 'invalid',
      requestId: 'req-3',
    }

    const response = await worker.handleMessage(request)

    expect(response).toMatchObject({
      requestId: 'req-3',
      success: false,
      error: expect.stringContaining('Unknown message type'),
    })
  })

  it('should include inference time in response', async () => {
    const request = {
      type: 'summary',
      input: 'Test input',
      requestId: 'req-4',
    }

    const startTime = Date.now()
    const response = await worker.handleMessage(request)
    const endTime = Date.now()

    expect(response.inferenceTimeMs).toBeGreaterThanOrEqual(0)
    expect(response.inferenceTimeMs).toBeLessThan(endTime - startTime + 100)
  })
})
```

**Key Points:**
- Tests message contracts (input/output shapes)
- Mocks WebLLM to avoid model loading
- Validates error handling
- Checks performance metadata (inference time)

---

## 3. Quality Validation

### 3.1 Response Quality Criteria

**Challenge:** AI responses vary, but must meet minimum quality standards.

**Solution:** Use heuristic validation (length, keywords, structure).

#### Pattern: Quality Validators

```typescript
// tests/support/validators/ai-quality.ts

/**
 * Validates video summary quality.
 * Checks for minimum length, key sections, no hallucinations.
 */
export function validateSummary(summary: string, transcript: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Minimum length check (summaries should be substantive)
  if (summary.length < 100) {
    errors.push('Summary too short (< 100 chars)')
  }

  // Maximum length check (summaries should be concise)
  if (summary.length > transcript.length * 0.5) {
    errors.push('Summary too long (> 50% of transcript)')
  }

  // Structure check: Should contain key phrases
  const hasKeyPhrases = ['key points:', 'main concepts:', 'summary:'].some(phrase =>
    summary.toLowerCase().includes(phrase)
  )
  if (!hasKeyPhrases) {
    errors.push('Missing structured summary format')
  }

  // Hallucination check: Summary should not introduce new topics
  const transcriptWords = new Set(transcript.toLowerCase().split(/\s+/))
  const summaryWords = summary.toLowerCase().split(/\s+/)
  const newWords = summaryWords.filter(w => w.length > 4 && !transcriptWords.has(w))

  if (newWords.length > summary.split(/\s+/).length * 0.2) {
    errors.push(`Potential hallucination: ${newWords.length} new words introduced`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates Q&A response quality.
 */
export function validateQAResponse(
  question: string,
  answer: string,
  contextNotes: string[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Minimum length
  if (answer.length < 50) {
    errors.push('Answer too short (< 50 chars)')
  }

  // Answer should be relevant to question (keyword overlap)
  const questionWords = new Set(
    question.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  )
  const answerWords = new Set(
    answer.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  )
  const overlap = [...questionWords].filter(w => answerWords.has(w))

  if (overlap.length === 0) {
    errors.push('Answer not relevant to question (no keyword overlap)')
  }

  // Answer should reference context notes
  const contextWords = contextNotes.join(' ').toLowerCase()
  const answerReferencesContext = answer.split(/\s+/).some(word =>
    word.length > 4 && contextWords.includes(word.toLowerCase())
  )

  if (!answerReferencesContext) {
    errors.push('Answer does not reference provided notes')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
```

#### Example: Quality Validation in Tests

```typescript
// tests/e2e/story-e09-s01-video-summaries-quality.spec.ts
import { test, expect } from '@playwright/test'
import { validateSummary } from '../support/validators/ai-quality'

test.describe('AI Response Quality Validation', () => {
  test('summary meets quality standards', async ({ page }) => {
    // Use real LLM (local execution only)
    await page.goto('/courses/react-101/lesson-1')
    await page.getByRole('button', { name: 'Generate Summary' }).click()
    await expect(page.getByTestId('summary-content')).toBeVisible({ timeout: 30000 })

    // Extract generated summary
    const summaryText = await page.getByTestId('summary-content').textContent()
    const transcript = await page.evaluate(() => {
      return (window as any).__videoTranscript // Assume transcript available
    })

    // Validate quality
    const validation = validateSummary(summaryText!, transcript)

    if (!validation.isValid) {
      console.error('Summary quality issues:', validation.errors)
    }

    expect(validation.isValid).toBe(true)
  })
})
```

**Key Points:**
- Heuristic validation (not deterministic, but consistent criteria)
- Tests run local only (require real LLM)
- Flags quality issues without failing on minor variations

---

### 3.2 Edge Case Testing

#### Pattern: Edge Case Test Suite

```typescript
// tests/e2e/ai-edge-cases.spec.ts
import { test, expect } from '@playwright/test'
import { mockAIWorkerResponses } from '../support/helpers/ai-worker-mock'

test.describe('AI Edge Cases', () => {
  test('handles empty input gracefully', async ({ page }) => {
    await mockAIWorkerResponses(page, [
      {
        type: 'summary',
        input: '',
        output: 'No content provided',
      },
    ])

    await page.goto('/ai-assistant')
    await page.getByPlaceholder('Enter video transcript...').fill('')
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    await expect(page.getByText('Please provide content to summarize')).toBeVisible()
  })

  test('handles very long input (10k+ chars)', async ({ page }) => {
    const longTranscript = 'Lorem ipsum dolor sit amet. '.repeat(500) // ~15k chars

    await mockAIWorkerResponses(page, [
      {
        type: 'summary',
        input: longTranscript,
        output: 'Summary of long transcript...',
      },
    ])

    await page.goto('/ai-assistant')
    await page.getByPlaceholder('Enter video transcript...').fill(longTranscript)
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Should truncate or chunk large inputs
    await expect(page.getByText('Summary of long transcript')).toBeVisible({ timeout: 10000 })
  })

  test('handles malformed UTF-8 input', async ({ page }) => {
    const malformedInput = 'Test \uD800 invalid surrogate'

    await mockAIWorkerResponses(page, [
      {
        type: 'summary',
        input: malformedInput,
        output: 'Processed summary',
      },
    ])

    await page.goto('/ai-assistant')
    await page.getByPlaceholder('Enter video transcript...').fill(malformedInput)
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Should handle gracefully without crashing
    await expect(page.getByText('Processed summary')).toBeVisible()
  })

  test('handles concurrent requests (request queuing)', async ({ page }) => {
    await page.goto('/ai-assistant')

    // Fire 3 requests quickly
    await page.getByRole('button', { name: 'Generate Summary' }).click()
    await page.getByRole('button', { name: 'Generate Summary' }).click()
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Should queue requests (not process all simultaneously)
    const loadingIndicators = page.getByTestId('summary-loading')
    const count = await loadingIndicators.count()

    // Only 1 request should be processing at a time
    expect(count).toBeLessThanOrEqual(1)
  })
})
```

**Key Points:**
- Tests boundary conditions (empty, very long, malformed)
- Validates concurrency handling (request queuing)
- Ensures graceful degradation (no crashes)

---

## 4. Performance Benchmarking

### 4.1 Inference Time Thresholds

**Requirement:** AI features must respond within acceptable latency.

**Thresholds:**
- **Summary generation**: < 5 seconds (local inference)
- **Q&A response**: < 3 seconds (retrieval + generation)
- **Vector search**: < 500ms (10k vectors)
- **Embedding generation**: < 2 seconds per note

#### Pattern: Performance Test Suite

```typescript
// tests/performance/ai-inference-benchmarks.spec.ts
import { test, expect } from '@playwright/test'

test.describe('AI Performance Benchmarks (Local Only)', () => {
  test('summary generation completes within 5 seconds', async ({ page }) => {
    await page.goto('/courses/react-101/lesson-1')

    const startTime = Date.now()
    await page.getByRole('button', { name: 'Generate Summary' }).click()
    await expect(page.getByTestId('summary-content')).toBeVisible({ timeout: 6000 })
    const endTime = Date.now()

    const inferenceTime = endTime - startTime
    console.log(`Summary inference time: ${inferenceTime}ms`)

    expect(inferenceTime).toBeLessThan(5000)
  })

  test('vector search completes within 500ms', async ({ page }) => {
    // Seed 10k notes with embeddings
    const notes = Array.from({ length: 10000 }, (_, i) => ({
      id: `note-${i}`,
      content: `Test note ${i}`,
      embedding: new Float32Array(384).fill(Math.random()),
    }))

    await page.evaluate(async (notes) => {
      const db = await window.indexedDB.open('ElearningDB')
      const tx = db.transaction('notes', 'readwrite')
      for (const note of notes) {
        tx.objectStore('notes').put(note)
      }
    }, notes)

    await page.goto('/ai-assistant')

    const startTime = Date.now()
    await page.getByPlaceholder('Search notes...').fill('How do React hooks work?')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByTestId('search-results')).toBeVisible()
    const endTime = Date.now()

    const searchTime = endTime - startTime
    console.log(`Vector search time (10k notes): ${searchTime}ms`)

    expect(searchTime).toBeLessThan(500)
  })
})
```

**Key Points:**
- Tests run local only (require real LLM/WebGPU)
- Validates latency thresholds
- Logs performance metrics to console
- Fails if thresholds exceeded

---

### 4.2 Memory Constraints

**Requirement:** AI features must not exceed memory limits.

**Thresholds:**
- **Model memory**: < 2GB (1B parameter model)
- **Embedding cache**: < 100MB (10k notes)
- **Worker memory**: < 500MB total

#### Pattern: Memory Profiling

```typescript
// tests/performance/ai-memory-profiling.spec.ts
import { test, expect } from '@playwright/test'

test.describe('AI Memory Profiling (Local Only)', () => {
  test('model loading does not exceed 2GB', async ({ page }) => {
    await page.goto('/ai-assistant')

    // Trigger model load
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Wait for model initialization
    await expect(page.getByTestId('model-ready')).toBeVisible({ timeout: 30000 })

    // Measure memory usage via Performance API
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        const mem = (performance as any).memory
        return {
          usedJSHeapSize: mem.usedJSHeapSize / (1024 * 1024), // MB
          totalJSHeapSize: mem.totalJSHeapSize / (1024 * 1024),
          jsHeapSizeLimit: mem.jsHeapSizeLimit / (1024 * 1024),
        }
      }
      return null
    })

    console.log('Memory usage after model load:', memoryUsage)

    if (memoryUsage) {
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(2048) // < 2GB
    }
  })

  test('embedding cache does not exceed 100MB', async ({ page }) => {
    // Seed 10k notes with embeddings
    const notes = Array.from({ length: 10000 }, (_, i) => ({
      id: `note-${i}`,
      content: `Test note ${i}`,
      embedding: Array.from({ length: 384 }, () => Math.random()),
    }))

    await page.evaluate(async (notes) => {
      const request = indexedDB.open('ElearningDB')
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('notes', 'readwrite')
        for (const note of notes) {
          tx.objectStore('notes').put(note)
        }
      }
    }, notes)

    // Estimate cache size
    const cacheSize = await page.evaluate(async () => {
      const estimate = await navigator.storage.estimate()
      return estimate.usage! / (1024 * 1024) // MB
    })

    console.log(`IndexedDB cache size: ${cacheSize}MB`)

    expect(cacheSize).toBeLessThan(100)
  })
})
```

**Key Points:**
- Uses Performance API for memory profiling
- Tests storage constraints (IndexedDB quota)
- Logs memory usage for analysis
- Fails if limits exceeded

---

## 5. E2E Test Patterns

### 5.1 Testing Offline/Degraded Scenarios

```typescript
// tests/e2e/ai-offline-scenarios.spec.ts
import { test, expect } from '@playwright/test'

test.describe('AI Offline/Degraded Scenarios', () => {
  test('handles missing WebGPU gracefully', async ({ page }) => {
    // Mock WebGPU as unavailable
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        configurable: true,
      })
    })

    await page.goto('/ai-assistant')

    // Should show fallback UI
    await expect(page.getByText('WebGPU not supported')).toBeVisible()
    await expect(page.getByText('Please use Chrome 113+ or Safari 17+')).toBeVisible()
  })

  test('handles model download failure', async ({ page }) => {
    // Mock fetch to fail for model downloads
    await page.route('https://huggingface.co/**', route => {
      route.abort('failed')
    })

    await page.goto('/ai-assistant')
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Should show error and retry option
    await expect(page.getByText('Failed to download AI model')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry Download' })).toBeVisible()
  })

  test('handles worker crash gracefully', async ({ page }) => {
    await page.goto('/ai-assistant')

    // Simulate worker termination
    await page.evaluate(() => {
      const worker = (window as any).__aiWorker
      if (worker) worker.terminate()
    })

    await page.getByRole('button', { name: 'Generate Summary' }).click()

    // Should detect worker failure and restart
    await expect(page.getByText('AI worker restarting...')).toBeVisible()
    await expect(page.getByTestId('summary-content')).toBeVisible({ timeout: 10000 })
  })
})
```

---

### 5.2 Full User Journey Tests

```typescript
// tests/e2e/ai-full-journey.spec.ts
import { test, expect } from '@playwright/test'
import { mockAIWorkerResponses } from '../support/helpers/ai-worker-mock'
import { seedNotesWithEmbeddings } from '../support/helpers/ai-seed'
import { createNoteWithEmbedding, FIXED_EMBEDDINGS } from '../support/fixtures/factories/embedding-factory'

test.describe('AI Full User Journey', () => {
  test('user generates summary, searches notes, asks question', async ({ page }) => {
    // Step 1: Seed notes
    const notes = [
      createNoteWithEmbedding({
        content: 'React hooks introduction',
        embedding: FIXED_EMBEDDINGS['react-intro'],
      }),
      createNoteWithEmbedding({
        content: 'State management patterns',
        embedding: FIXED_EMBEDDINGS['state-management'],
      }),
    ]
    await seedNotesWithEmbeddings(page, notes)

    // Step 2: Mock LLM responses
    await mockAIWorkerResponses(page, [
      {
        type: 'summary',
        input: 'Video transcript...',
        output: 'This video covers React hooks basics.',
      },
      {
        type: 'question-answer',
        input: 'How do hooks work?',
        output: 'Hooks allow functional components to use state and lifecycle features.',
      },
    ])

    // Step 3: Generate summary
    await page.goto('/courses/react-101/lesson-1')
    await page.getByRole('button', { name: 'Generate Summary' }).click()
    await expect(page.getByText('This video covers React hooks basics')).toBeVisible()

    // Step 4: Search notes
    await page.goto('/ai-assistant')
    await page.getByPlaceholder('Search notes...').fill('React hooks')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('React hooks introduction')).toBeVisible()

    // Step 5: Ask question
    await page.getByPlaceholder('Ask a question...').fill('How do hooks work?')
    await page.getByRole('button', { name: 'Ask' }).click()
    await expect(page.getByText('Hooks allow functional components')).toBeVisible()

    // All steps completed successfully
  })
})
```

---

## 6. CI Integration Recommendations

### 6.1 Test Execution Matrix

| Test Suite | Environment | Browser | Frequency |
|------------|-------------|---------|-----------|
| **Unit (vector math)** | CI + Local | N/A (Vitest) | Every commit |
| **Integration (workers)** | CI + Local | N/A (Vitest) | Every commit |
| **E2E (mocked AI)** | CI + Local | Chromium | Every PR |
| **E2E (real AI)** | Local only | Chromium | Manual (pre-release) |
| **Performance** | Local only | Chromium | Weekly |

### 6.2 CI Configuration

```yaml
# .github/workflows/ai-tests.yml
name: AI Tests

on:
  pull_request:
    paths:
      - 'src/workers/**'
      - 'src/lib/ai/**'
      - 'tests/**ai**'

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:unit -- src/lib/vectorMath.test.ts
      - run: npm run test:unit -- src/workers/__tests__/

  e2e-mocked:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install chromium
      - run: npx playwright test tests/e2e/*ai*.spec.ts
        env:
          SKIP_REAL_AI: true # Skip tests requiring real LLM
```

### 6.3 Local-Only Test Identification

```typescript
// tests/e2e/ai-real-inference.spec.ts
import { test, expect } from '@playwright/test'

// Skip in CI (requires WebGPU)
test.skip(!!process.env.CI, 'Real AI tests require local WebGPU')

test.describe('AI Real Inference (Local Only)', () => {
  test('summary generation with real LLM', async ({ page }) => {
    // ... real LLM test
  })
})
```

---

## 7. Test Data Factories

### 7.1 AI-Specific Factories

```typescript
// tests/support/fixtures/factories/ai-factory.ts
import { FIXED_TIMESTAMP } from '../../../utils/test-time'

export interface AIModelMetadata {
  modelId: string
  modelName: string
  parametersB: number // Billion parameters
  downloadSizeMB: number
  contextLength: number
  loadedAt: string
}

export function createAIModelMetadata(
  overrides: Partial<AIModelMetadata> = {}
): AIModelMetadata {
  return {
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    modelName: 'Llama 3.2 1B',
    parametersB: 1.2,
    downloadSizeMB: 664,
    contextLength: 131072,
    loadedAt: new Date(FIXED_TIMESTAMP).toISOString(),
    ...overrides,
  }
}

export interface EmbeddingJobMetadata {
  jobId: string
  noteCount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

export function createEmbeddingJob(
  overrides: Partial<EmbeddingJobMetadata> = {}
): EmbeddingJobMetadata {
  return {
    jobId: crypto.randomUUID(),
    noteCount: 0,
    status: 'pending',
    startedAt: new Date(FIXED_TIMESTAMP).toISOString(),
    ...overrides,
  }
}

export interface VectorSearchResult {
  noteId: string
  similarity: number
  content: string
  courseId: string
  videoId: string
}

export function createSearchResult(
  overrides: Partial<VectorSearchResult> = {}
): VectorSearchResult {
  return {
    noteId: crypto.randomUUID(),
    similarity: 0.85,
    content: 'Test search result content',
    courseId: 'course-1',
    videoId: 'lesson-1',
    ...overrides,
  }
}
```

---

## 8. Summary & Best Practices

### 8.1 Key Principles

✅ **DO:**
- Use fixed embeddings for deterministic search tests
- Mock LLM responses at worker boundary
- Test worker message contracts in isolation
- Validate response quality with heuristics
- Run real AI tests local only (WebGPU required)
- Measure performance (latency, memory) in local tests
- Test edge cases (empty input, very long input, concurrent requests)

❌ **DON'T:**
- Mock application code (mock at boundaries only)
- Run real LLM inference in CI (WebGPU unavailable)
- Use `waitForTimeout()` for AI responses (use event-based waits)
- Hardcode expected AI outputs (responses vary)
- Test exact AI output text (use quality validators instead)

### 8.2 Test Coverage Targets

| Component | Unit Tests | Integration Tests | E2E Tests |
|-----------|-----------|-------------------|-----------|
| **Vector math** | 100% | N/A | N/A |
| **Embedding pipeline** | 80%+ | 100% | 50%+ (mocked) |
| **Vector search** | 90%+ | 100% | 80%+ (fixed data) |
| **LLM inference** | N/A | 100% (mocked) | 50%+ (mocked) |
| **Worker communication** | N/A | 100% | 80%+ |
| **UI interactions** | N/A | N/A | 90%+ |

### 8.3 Test Execution Checklist

Before merging Epic 9 PRs:

- [ ] All unit tests pass (vector math, search algorithms)
- [ ] All integration tests pass (worker contracts, IndexedDB)
- [ ] E2E tests with mocked AI pass in CI
- [ ] E2E tests with real AI pass locally (manual run)
- [ ] Performance benchmarks meet thresholds (local)
- [ ] Memory profiling shows acceptable usage (local)
- [ ] Edge cases tested (empty, long, malformed input)
- [ ] Error handling validated (offline, failures, retries)

---

## 9. References

**Existing Test Patterns:**
- `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/utils/test-time.ts` - Deterministic time utilities
- `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/support/helpers/indexeddb-seed.ts` - IndexedDB seeding patterns
- `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/support/fixtures/factories/` - Data factory patterns

**Knowledge Base:**
- `_bmad/tea/testarch/knowledge/test-quality.md` - Quality criteria
- `_bmad/tea/testarch/knowledge/data-factories.md` - Factory patterns
- `_bmad/tea/testarch/knowledge/timing-debugging.md` - Wait strategies

**Epic 9 Research:**
- `docs/research/webllm-feasibility-report.md` - WebLLM integration
- `docs/planning-artifacts/web-worker-architecture.md` - Worker design
- `docs/plans/epic-9-prep-sprint.md` - Epic 9 preparation plan

**Libraries:**
- `@mlc-ai/web-llm` - Browser LLM inference
- `@playwright/test` - E2E testing framework
- `vitest` - Unit/integration testing
- `Dexie.js` - IndexedDB wrapper

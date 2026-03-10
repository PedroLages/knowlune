# Epic 9 Worker Integration Checklist

**Quick Reference for Developers**
**See also:** epic-9-web-worker-design.md (full design), epic-9-worker-communication-flows.md (sequence diagrams)

---

## 1. When to Use Workers

### ✅ Use Workers For:
- **Embedding generation** (>10 notes)
- **Vector search** (>100 vectors)
- **LLM inference** (any length)
- **Batch processing** (any AI task on >5 items)

### ❌ Don't Use Workers For:
- **Single embeddings** (<5 notes) - overhead not worth it
- **Simple text search** - MiniSearch on main thread is fine
- **UI state updates** - Workers can't touch React/Zustand directly

---

## 2. Quick Start: Using the Coordinator

### Basic Embedding Example

```typescript
import { generateEmbeddings } from '@/ai/workers/coordinator'

// In your component or store
async function saveNoteWithEmbedding(content: string) {
  try {
    // 1. Generate embedding (runs in worker)
    const [embedding] = await generateEmbeddings([content])

    // 2. Save to Dexie (main thread)
    await db.notes.add({
      id: crypto.randomUUID(),
      content,
      embedding, // Float32Array
      createdAt: new Date().toISOString(),
    })

    toast.success('Note saved and indexed')
  } catch (error) {
    console.error('Failed to save note:', error)
    toast.error('AI indexing failed. Note saved without search support.')
  }
}
```

### Semantic Search Example

```typescript
import { generateEmbeddings, searchSimilarNotes } from '@/ai/workers/coordinator'

async function searchNotes(query: string) {
  try {
    // 1. Generate query embedding
    const [queryVector] = await generateEmbeddings([query])

    // 2. Search vector index (runs in worker)
    const results = await searchSimilarNotes(queryVector, 10)

    // 3. Fetch full notes from Dexie
    const noteIds = results.map(r => r.noteId)
    const notes = await db.notes.bulkGet(noteIds)

    return notes.filter(Boolean)
  } catch (error) {
    console.error('Search failed:', error)
    toast.error('Search failed. Please try again.')
    return []
  }
}
```

### Batch Processing Example

```typescript
import { generateEmbeddings } from '@/ai/workers/coordinator'

async function indexCourse(courseId: string) {
  const notes = await db.notes.where({ courseId }).toArray()

  // Batch in groups of 20 (balance between efficiency and memory)
  const BATCH_SIZE = 20
  const batches = []

  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    batches.push(notes.slice(i, i + BATCH_SIZE))
  }

  let processed = 0

  for (const batch of batches) {
    // 1. Generate embeddings for batch
    const embeddings = await generateEmbeddings(batch.map(n => n.content))

    // 2. Update notes with embeddings
    await Promise.all(
      batch.map((note, idx) =>
        db.notes.update(note.id, { embedding: embeddings[idx] })
      )
    )

    processed += batch.length

    // 3. Update progress
    console.log(`Indexed ${processed}/${notes.length} notes`)
  }

  toast.success(`Indexed ${notes.length} notes for AI search`)
}
```

---

## 3. Integration with Zustand Stores

### Pattern: Optimistic Updates with Background AI

```typescript
// src/stores/useNoteStore.ts
import { create } from 'zustand'
import { db } from '@/db'
import { generateEmbeddings } from '@/ai/workers/coordinator'
import type { Note } from '@/data/types'

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],

  saveNote: async (note: Note) => {
    // 1. Optimistic update (immediate UI feedback)
    set({ notes: [...get().notes, note] })

    try {
      // 2. Save to Dexie (fast)
      await db.notes.add(note)

      // 3. Generate embedding in background (slow, non-blocking)
      generateEmbeddings([note.content])
        .then(([embedding]) => {
          return db.notes.update(note.id, { embedding })
        })
        .then(() => {
          // 4. Notify search worker to re-index
          window.dispatchEvent(
            new CustomEvent('note-indexed', { detail: { noteId: note.id } })
          )
        })
        .catch(error => {
          console.error('[NoteStore] Failed to generate embedding:', error)
          // Note: Don't rollback - note is still saved, just not indexed
        })
    } catch (error) {
      // Rollback optimistic update
      set({ notes: get().notes.filter(n => n.id !== note.id) })
      throw error
    }
  },
}))
```

### Pattern: Event-Driven State Updates

```typescript
// Worker signals completion via custom event
worker.postMessage({
  type: 'embedding-complete',
  noteId: 'note-123',
  embedding: Float32Array,
})

// Main thread listens and updates Zustand
window.addEventListener('embedding-complete', ((event: CustomEvent) => {
  const { noteId, embedding } = event.detail
  useNoteStore.getState().updateNoteEmbedding(noteId, embedding)
}) as EventListener)
```

---

## 4. Integration with Dexie (IndexedDB)

### Workers Access Dexie Directly

Workers instantiate their own Dexie connection:

```typescript
// src/ai/workers/embedding.worker.ts
import Dexie from 'dexie'
import type { Note } from '@/data/types'

const db = new Dexie('ElearningDB') as Dexie & {
  notes: EntityTable<Note, 'id'>
}

// Use same schema version as main thread
db.version(8).stores({
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
})

// Worker can now query directly
const notes = await db.notes.where({ courseId }).toArray()
```

**⚠️ Important:**
- Workers use **read-only access** to Dexie (avoid concurrent writes)
- Schema version **must match** main thread
- Share types via `@/data/types`

### Schema Sync Strategy

1. Define types in `src/data/types.ts`
2. Main thread owns schema migrations
3. Workers import types but **don't run migrations**
4. Keep worker Dexie version in sync with main thread

---

## 5. Error Handling Patterns

### User-Facing Errors

```typescript
try {
  const embeddings = await generateEmbeddings(texts)
} catch (error) {
  if (error.message.includes('timeout')) {
    toast.error('AI request timed out. Please try again.', {
      action: { label: 'Retry', onClick: () => generateEmbeddings(texts) },
    })
  } else if (error.message.includes('crashed')) {
    toast.error('AI service crashed. Switching to fallback.', {
      description: 'Your data is safe. We\'re restarting the AI service.',
    })
  } else {
    toast.error('AI indexing failed. Search may be incomplete.')
  }
}
```

### Graceful Degradation

```typescript
async function generateEmbeddingsWithFallback(texts: string[]): Promise<Float32Array[]> {
  try {
    return await generateEmbeddings(texts)
  } catch (error) {
    console.warn('[AI] Worker failed, falling back to main thread:', error)

    // Fallback to main thread (throttled to avoid UI freeze)
    const embeddings: Float32Array[] = []
    for (const text of texts) {
      const embedding = await generateEmbeddingMainThread(text)
      embeddings.push(embedding)

      // Yield to main thread every 5 embeddings
      if (embeddings.length % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    return embeddings
  }
}
```

### Retry Logic

```typescript
async function generateEmbeddingsWithRetry(
  texts: string[],
  maxRetries = 2
): Promise<Float32Array[]> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateEmbeddings(texts)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.warn(`[AI] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error)

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * 2 ** attempt, 5000) // 1s, 2s, 4s max
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError
}
```

---

## 6. Performance Best Practices

### ✅ DO: Batch Requests

```typescript
// ✅ GOOD: 1 worker message for 100 notes
const embeddings = await generateEmbeddings(notes.map(n => n.content))
notes.forEach((note, i) => {
  note.embedding = embeddings[i]
})

// ❌ BAD: 100 worker messages
for (const note of notes) {
  note.embedding = await generateEmbeddings([note.content])
}
```

### ✅ DO: Debounce User Input

```typescript
// ✅ GOOD: Search after 300ms of inactivity
const debouncedSearch = useDebouncedCallback(handleSearch, 300)
<input onChange={(e) => debouncedSearch(e.target.value)} />

// ❌ BAD: Search on every keystroke
<input onChange={(e) => handleSearch(e.target.value)} />
```

### ✅ DO: Use Transferable Objects

```typescript
// ✅ GOOD: Transfer ownership (zero-copy)
const embedding = new Float32Array(384)
worker.postMessage({ embedding }, [embedding.buffer])

// ❌ BAD: Clone (2x memory usage)
worker.postMessage({ embedding })
```

### ❌ DON'T: Send Large Objects

```typescript
// ❌ BAD: Serialize entire note object
worker.postMessage({ note })

// ✅ GOOD: Send only needed data
worker.postMessage({ content: note.content })
```

---

## 7. Memory Management Checklist

### Monitor Memory Usage

```typescript
// Get coordinator status
const status = coordinator.getStatus()
console.log('Active workers:', status.activeWorkers)
console.log('Pending requests:', status.pendingRequests)
console.log('Workers:', status.workers)
```

### Trigger Manual Cleanup

```typescript
// Terminate all workers (e.g., on settings page)
coordinator.terminate()

// Workers will respawn on next task (lazy loading)
```

### Memory Pressure Handling

```typescript
// Listen for memory pressure events
window.addEventListener('worker-crash', ((event: CustomEvent) => {
  const { workerId, error } = event.detail

  if (error.includes('OOM')) {
    // Switch to cloud API fallback
    useAIStore.getState().setProvider('cloud')
    toast.warning('AI models disabled due to memory constraints. Using cloud fallback.')
  }
}) as EventListener)
```

---

## 8. Testing Patterns

### Unit Test Workers (Vitest)

```typescript
import { describe, it, expect, vi } from 'vitest'
import { coordinator } from '@/ai/workers/coordinator'

// Mock Worker API
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  terminate: vi.fn(),
}))

describe('generateEmbeddings', () => {
  it('should generate embeddings for single text', async () => {
    const embeddings = await generateEmbeddings(['test'])
    expect(embeddings).toHaveLength(1)
    expect(embeddings[0]).toBeInstanceOf(Float32Array)
  })
})
```

### E2E Test Workers (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test('note embedding generation', async ({ page }) => {
  await page.goto('/notes')

  // Create note
  await page.fill('[data-testid="note-editor"]', 'Machine learning basics')
  await page.click('[data-testid="save-note"]')

  // Wait for embedding (worker async)
  await page.waitForFunction(() => {
    return window.localStorage.getItem('embedding-complete') === 'true'
  })

  // Verify searchable
  await page.fill('[data-testid="search-input"]', 'ML fundamentals')
  await expect(page.getByText('Machine learning basics')).toBeVisible()
})
```

### Mock Workers for Deterministic Tests

```typescript
// tests/support/helpers/mock-workers.ts
export async function mockEmbeddingWorker(page: Page) {
  await page.addInitScript(() => {
    window.Worker = class MockWorker {
      postMessage(message: any) {
        const { requestId, type, payload } = message

        if (type === 'embed') {
          // Return deterministic fake embeddings
          const embeddings = payload.texts.map(() => new Float32Array(384))

          setTimeout(() => {
            this.dispatchEvent(
              new MessageEvent('message', {
                data: { requestId, type: 'success', result: { embeddings } },
              })
            )
          }, 10)
        }
      }
    } as any
  })
}
```

---

## 9. Vite Configuration

### Required Vite Settings

```typescript
// vite.config.ts
export default defineConfig({
  // Worker support
  worker: {
    format: 'es', // ES modules in workers
  },

  // COOP/COEP headers (required for SharedArrayBuffer)
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  // Code splitting (separate WebLLM into own chunk)
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) {
            return 'webllm'
          }
        },
      },
    },
  },

  // Optimize deps
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'], // Don't pre-bundle (too large)
  },
})
```

---

## 10. Browser Compatibility

### Feature Detection

```typescript
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

export function supportsWebGPU(): boolean {
  return 'gpu' in navigator
}

export function detectWorkerFeatures() {
  return {
    workers: supportsWorkers(),
    moduleWorkers: 'type' in new Worker('', { type: 'module' }),
    webGPU: supportsWebGPU(),
    indexedDB: typeof indexedDB !== 'undefined',
  }
}
```

### Graceful Fallback

```typescript
if (!supportsWorkers()) {
  toast.warning('Your browser doesn\'t support AI features. Please upgrade to Chrome 113+.')
  // Fallback to main thread or cloud API
}
```

---

## 11. Common Pitfalls

### ❌ DON'T: Send Functions to Workers

```typescript
// ❌ BAD: Functions can't be serialized
worker.postMessage({ callback: () => console.log('done') })

// ✅ GOOD: Use event-driven pattern
worker.postMessage({ requestId: 'uuid-1' })
worker.addEventListener('message', (e) => {
  if (e.data.requestId === 'uuid-1') {
    console.log('done')
  }
})
```

### ❌ DON'T: Access DOM from Workers

```typescript
// ❌ BAD: Workers have no DOM access
self.document.querySelector('.note') // Error!

// ✅ GOOD: Pass data via postMessage
self.postMessage({ result: processedData })
```

### ❌ DON'T: Share State Directly

```typescript
// ❌ BAD: Workers can't access main thread state
const notes = useNoteStore.getState().notes // Error!

// ✅ GOOD: Pass state snapshot via postMessage
worker.postMessage({ notes: [...useNoteStore.getState().notes] })
```

### ❌ DON'T: Forget to Handle Errors

```typescript
// ❌ BAD: Unhandled rejection
await generateEmbeddings(texts)

// ✅ GOOD: Always handle errors
try {
  await generateEmbeddings(texts)
} catch (error) {
  toast.error('AI indexing failed')
  console.error(error)
}
```

---

## 12. Migration Checklist

### Phase 1: Foundation (Stories 1-3)
- [ ] Install dependencies (`@xenova/transformers`, MeMemo HNSW)
- [ ] Create worker files (`embedding.worker.ts`, `search.worker.ts`, `inference.worker.ts`)
- [ ] Implement coordinator with message protocol
- [ ] Add Vite configuration (headers, code splitting)
- [ ] Write unit tests for coordinator
- [ ] Add E2E test mocks

### Phase 2: Embedding Integration (Story 4)
- [ ] Replace mock embedding worker with Transformers.js
- [ ] Integrate with `useNoteStore.saveNote()`
- [ ] Add batch processing for course import
- [ ] Test with 10k notes
- [ ] Monitor memory usage

### Phase 3: Vector Search (Story 5)
- [ ] Create search worker with HNSW index
- [ ] Implement `searchSimilarNotes()` API
- [ ] Add search UI to notes page
- [ ] Cache index in IndexedDB
- [ ] Benchmark search performance

### Phase 4: LLM Inference (Story 6)
- [ ] Create inference worker with WebLLM
- [ ] Implement streaming API
- [ ] Add model download progress UI
- [ ] Test with video summaries
- [ ] Validate memory usage < 2GB

---

## 13. Quick Reference: API Surface

| Function | Purpose | Latency | Memory |
|----------|---------|---------|--------|
| `generateEmbeddings(texts: string[])` | Generate 384-dim vectors | ~50ms per text | +150MB |
| `searchSimilarNotes(vector, topK)` | Vector similarity search | ~20ms | +100MB |
| `loadVectorIndex(vectors)` | Initialize search index | ~5s (10k vectors) | +100MB |
| `streamInfer(prompt, onChunk)` | LLM text generation | ~15s (500 tokens) | +2GB |
| `coordinator.getStatus()` | Pool status (debugging) | <1ms | 0MB |
| `coordinator.terminate()` | Cleanup all workers | <1ms | Reclaim all |

---

## 14. Resources

**Design Docs:**
- [epic-9-web-worker-design.md](./epic-9-web-worker-design.md) - Full architecture
- [epic-9-worker-communication-flows.md](./epic-9-worker-communication-flows.md) - Sequence diagrams

**Code:**
- [src/ai/workers/coordinator.ts](../../src/ai/workers/coordinator.ts) - Coordinator implementation
- [src/ai/workers/types.ts](../../src/ai/workers/types.ts) - Message protocol types
- [src/ai/workers/embedding.worker.ts](../../src/ai/workers/embedding.worker.ts) - Embedding worker

**Tests:**
- [src/ai/workers/__tests__/coordinator.test.ts](../../src/ai/workers/__tests__/coordinator.test.ts) - Unit tests
- [tests/e2e/ai-workers.spec.ts](../../tests/e2e/ai-workers.spec.ts) - E2E tests

**External Docs:**
- [MDN: Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [MDN: Transferable Objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [WebLLM Docs](https://webllm.mlc.ai/)

---

**Last Updated:** 2026-03-10
**Status:** Ready for Implementation

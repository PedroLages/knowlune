# Web Worker Architecture for Epic 9 AI Workloads

**Document Status:** Architecture Design
**Created:** 2026-03-09
**Epic:** Epic 9 - AI-Powered Learning Assistant
**Author:** Claude (Sonnet 4.5)

---

## Executive Summary

This document defines the Web Worker architecture for CPU/memory-intensive AI operations in Epic 9, ensuring the main thread remains responsive during:
- Vector embedding generation (text → 384-1536 dimension vectors)
- Vector similarity search (RAG pipeline for Q&A)
- LLM inference (on-device with WebLLM for privacy-first scenarios)
- Batch processing (auto-analysis on course import)

The architecture uses a **dedicated worker pool pattern** with IndexedDB-backed caching, structured message passing, and graceful degradation for unsupported browsers.

---

## Context & Requirements

### Epic 9 AI Features

| Feature | Story | AI Workload | Blocking? |
|---------|-------|-------------|-----------|
| Video Summary | 9.2 | LLM inference (streaming) | Yes (30s timeout) |
| Q&A from Notes | 9.3 | Vector search + LLM | Yes (chat interaction) |
| Learning Path | 9.4 | Text analysis + ranking | No (background) |
| Knowledge Gaps | 9.5 | Pattern detection | No (background) |
| Note Organization | 9.6 | Embedding + clustering | No (preview before apply) |
| Auto-Analysis | 9.7 | Batch embeddings on import | No (progressive) |

### Non-Functional Requirements

- **NFR7:** Memory usage ≤50MB increase over 2-hour session
- **NFR26:** AI API timeout 30s with AbortController
- **NFR27:** API keys never in client code (edge function proxy)
- **NFR33:** Large file handling (2GB+) without memory spike

### Current Stack

- **Framework:** React 18.3 + Vite 6.3.5 + TypeScript
- **Data Layer:** Dexie.js v4.3.0 (IndexedDB wrapper)
- **AI SDK:** Vercel AI SDK v2.0.31 (@ai-sdk/openai, @ai-sdk/anthropic)
- **Search:** MiniSearch v7.2.0 (full-text search)
- **Existing Worker:** `src/lib/pdfWorker.ts` (PDF.js Web Worker configuration)

---

## Architecture Design

### 1. Worker Structure: Dedicated Worker Pool

**Decision:** Use a **shared worker pool** (3 workers) managed by a coordinator module, NOT shared workers or single-use workers.

**Rationale:**
- **Shared Workers** are not supported in all browsers (Safari 16.4+, but gaps in mobile)
- **Dedicated Workers** have full browser support and simpler lifecycle management
- **Pool Size:** 3 workers balances parallelism (embeddings batch) vs memory overhead
- **Coordinator Pattern:** Single point of contact for React components, handles load balancing

### 2. File Structure

```
src/
├── ai/
│   ├── workers/
│   │   ├── coordinator.ts          # Worker pool manager + message router
│   │   ├── embedding.worker.ts     # Vector embedding generation
│   │   ├── inference.worker.ts     # LLM inference (WebLLM or API proxy)
│   │   └── search.worker.ts        # Vector similarity search
│   ├── client.ts                   # Vercel AI SDK wrapper (existing)
│   ├── embeddings.ts               # Embedding API (calls coordinator)
│   ├── inference.ts                # Inference API (calls coordinator)
│   └── vector-store.ts             # IndexedDB vector storage
├── db/
│   └── schema.ts                   # Add embeddings table
└── lib/
    └── pdfWorker.ts                # Existing PDF.js worker config
```

### 3. Worker Responsibilities

#### 3.1 Coordinator (`coordinator.ts`)

**Main thread only.** Manages worker lifecycle and routes messages.

```typescript
// src/ai/workers/coordinator.ts
type WorkerTask = 'embed' | 'search' | 'infer'
type TaskPriority = 'high' | 'normal' | 'low'

interface WorkerPoolConfig {
  maxWorkers: 3
  idleTimeout: 60_000  // Terminate idle workers after 60s
  maxRetries: 2
}

class WorkerCoordinator {
  private pool: Map<string, Worker> = new Map()
  private taskQueue: PriorityQueue<TaskRequest> = new PriorityQueue()
  private activeRequests: Map<string, AbortController> = new Map()

  async executeTask<T>(
    task: WorkerTask,
    payload: unknown,
    options?: { priority?: TaskPriority; timeout?: number }
  ): Promise<T> {
    // 1. Select least-busy worker (or spawn if pool not full)
    // 2. Send structured message with request ID
    // 3. Return promise that resolves on worker response
    // 4. Handle timeout (default 30s per NFR26)
    // 5. Handle worker errors and retry with different worker
  }

  private getOrCreateWorker(task: WorkerTask): Worker {
    // Lazy-load workers based on task type
    // Cache worker instances, reuse across tasks
    // Terminate workers after idle timeout
  }

  terminate(): void {
    // Cleanup on app unmount or idle timeout
    this.pool.forEach(worker => worker.terminate())
  }
}

export const coordinator = new WorkerCoordinator()
```

**Key Features:**
- **Lazy loading:** Workers only spawned when needed
- **Connection pooling:** Reuse workers across requests (faster than spawn-per-request)
- **Load balancing:** Round-robin or least-busy selection
- **Graceful shutdown:** Terminate idle workers after 60s to free memory

#### 3.2 Embedding Worker (`embedding.worker.ts`)

**Worker thread.** Generates vector embeddings for text.

```typescript
// src/ai/workers/embedding.worker.ts
import { pipeline, env } from '@xenova/transformers'

// Disable local model cache (IndexedDB only)
env.allowLocalModels = false
env.backends.onnx.wasm.numThreads = 1  // CRITICAL: Limit to 1 thread per worker

let embeddingPipeline: any = null

async function initializePipeline() {
  if (!embeddingPipeline) {
    // Use lightweight embedding model (~25MB)
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',  // 384-dim, 23MB model
      { device: 'wasm' }            // WebAssembly backend (CPU)
    )
  }
  return embeddingPipeline
}

self.onmessage = async (e: MessageEvent) => {
  const { requestId, type, payload } = e.data

  try {
    if (type === 'embed') {
      const pipeline = await initializePipeline()
      const { texts } = payload  // Array of strings (batch support)

      // Generate embeddings (returns Float32Array[])
      const result = await pipeline(texts, { pooling: 'mean', normalize: true })
      const embeddings = result.data  // 384-dim vectors

      self.postMessage({
        requestId,
        type: 'success',
        result: { embeddings }
      })
    }
  } catch (error) {
    self.postMessage({
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
```

**Key Features:**
- **Model:** `all-MiniLM-L6-v2` (384-dim, 23MB, fast inference)
- **Batch support:** Process multiple texts in single call (note organization)
- **WASM backend:** CPU-based, no GPU requirement
- **Lazy init:** Model loads on first use, cached for subsequent calls
- **Memory-safe:** Single-threaded WASM execution per worker

#### 3.3 Search Worker (`search.worker.ts`)

**Worker thread.** Performs vector similarity search for RAG pipeline.

```typescript
// src/ai/workers/search.worker.ts
import { cosineSimilarity } from '@/lib/vectorMath'

// In-memory vector index (loaded from IndexedDB)
let vectorIndex: Map<string, Float32Array> | null = null

self.onmessage = async (e: MessageEvent) => {
  const { requestId, type, payload } = e.data

  try {
    if (type === 'load-index') {
      // Load vectors from IndexedDB into worker memory
      const { vectors } = payload  // { noteId: Float32Array }[]
      vectorIndex = new Map(Object.entries(vectors))

      self.postMessage({ requestId, type: 'success' })
    }

    if (type === 'search') {
      if (!vectorIndex) {
        throw new Error('Vector index not loaded')
      }

      const { queryVector, topK = 5 } = payload

      // Compute cosine similarity for all vectors
      const results: Array<{ noteId: string; score: number }> = []
      for (const [noteId, vector] of vectorIndex.entries()) {
        const score = cosineSimilarity(queryVector, vector)
        results.push({ noteId, score })
      }

      // Sort by score descending, return top K
      results.sort((a, b) => b.score - a.score)
      const topResults = results.slice(0, topK)

      self.postMessage({
        requestId,
        type: 'success',
        result: { results: topResults }
      })
    }
  } catch (error) {
    self.postMessage({
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
```

**Key Features:**
- **In-memory index:** Vectors loaded once, reused across searches (fast)
- **Cosine similarity:** Standard metric for semantic search
- **Top-K retrieval:** Returns most relevant notes for RAG context
- **IndexedDB source:** Vectors persisted in `embeddings` table

#### 3.4 Inference Worker (`inference.worker.ts`)

**Worker thread.** Runs LLM inference (optional, for privacy-first mode).

```typescript
// src/ai/workers/inference.worker.ts
// NOTE: This worker is OPTIONAL. Default mode uses edge function proxy.
// Only enabled if user explicitly opts into on-device inference.

import { ChatWebLLM } from '@langchain/community/chat_models/webllm'

let chatModel: ChatWebLLM | null = null

async function initializeModel() {
  if (!chatModel) {
    chatModel = new ChatWebLLM({
      model: 'Phi-3.5-mini-instruct-q4f16_1-MLC',  // 2.3GB, runs on CPU
      temperature: 0.7,
      topP: 0.9
    })

    // Download and cache model (2.3GB download, user must consent)
    await chatModel.initialize((progress) => {
      self.postMessage({ type: 'download-progress', progress })
    })
  }
  return chatModel
}

self.onmessage = async (e: MessageEvent) => {
  const { requestId, type, payload } = e.data

  try {
    if (type === 'infer') {
      const model = await initializeModel()
      const { prompt, stream = false } = payload

      if (stream) {
        // Streaming response (for video summaries)
        const streamResponse = await model.stream(prompt)
        for await (const chunk of streamResponse) {
          self.postMessage({
            requestId,
            type: 'stream-chunk',
            chunk: chunk.content
          })
        }
        self.postMessage({ requestId, type: 'stream-end' })
      } else {
        // Non-streaming response
        const response = await model.invoke(prompt)
        self.postMessage({
          requestId,
          type: 'success',
          result: { text: response.content }
        })
      }
    }
  } catch (error) {
    self.postMessage({
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
```

**Key Features:**
- **Optional mode:** Only used if user enables "On-Device Inference" in settings
- **Model:** Phi-3.5-mini (2.3GB, quantized Q4, runs on CPU/WebGPU)
- **Streaming support:** For real-time summary generation
- **Large download:** Must show progress UI, cache model in IndexedDB
- **Fallback:** If unavailable, fall back to edge function proxy

**Default Mode (Edge Function):**
Most users will use edge function proxy (NFR27: API keys server-side). Inference worker only for privacy-focused users who accept 2.3GB download.

---

### 4. Message Passing Protocol

All messages follow structured format for type safety and error handling.

#### 4.1 Request Message

```typescript
interface WorkerRequest<T = unknown> {
  requestId: string          // UUID for tracking
  type: 'embed' | 'search' | 'infer' | 'load-index'
  payload: T
  timeout?: number           // Override default 30s
}
```

#### 4.2 Response Messages

```typescript
// Success response
interface WorkerSuccessResponse<T = unknown> {
  requestId: string
  type: 'success'
  result: T
}

// Error response
interface WorkerErrorResponse {
  requestId: string
  type: 'error'
  error: string              // Human-readable error message
}

// Streaming chunk (for inference)
interface WorkerStreamChunk {
  requestId: string
  type: 'stream-chunk' | 'stream-end'
  chunk?: string             // Only present for 'stream-chunk'
}

// Progress update (for model download)
interface WorkerProgressUpdate {
  type: 'download-progress'
  progress: number           // 0-100
}
```

#### 4.3 TypeScript Types

```typescript
// src/ai/workers/types.ts
export type WorkerRequestType = 'embed' | 'search' | 'infer' | 'load-index'
export type WorkerResponseType = 'success' | 'error' | 'stream-chunk' | 'stream-end' | 'download-progress'

export interface EmbedPayload {
  texts: string[]            // Batch of texts to embed
}

export interface EmbedResult {
  embeddings: Float32Array[] // 384-dim vectors
}

export interface SearchPayload {
  queryVector: Float32Array
  topK?: number              // Default: 5
}

export interface SearchResult {
  results: Array<{
    noteId: string
    score: number            // Cosine similarity 0-1
  }>
}

export interface InferPayload {
  prompt: string
  stream?: boolean           // Default: false
}

export interface InferResult {
  text: string
}
```

---

### 5. IndexedDB Vector Storage

Add `embeddings` table to Dexie schema for persistent vector cache.

```typescript
// src/db/schema.ts (add to existing schema)

export interface NoteEmbedding {
  noteId: string              // Primary key (references notes.id)
  embedding: Float32Array     // 384-dim vector
  model: string               // 'all-MiniLM-L6-v2'
  createdAt: string           // ISO timestamp
}

db.version(9).stores({
  // ... existing tables
  embeddings: 'noteId, createdAt',
})
```

**Storage Strategy:**
- **Lazy generation:** Embeddings created on-demand (first Q&A query or note organization)
- **Persistent cache:** Avoid re-computing embeddings for same text
- **Invalidation:** Delete embedding if note content changes
- **Size:** 384 floats × 4 bytes = 1.5KB per note (1000 notes = 1.5MB)

---

### 6. React Component Integration

Components interact with workers via high-level API (coordinator abstraction).

#### 6.1 Video Summary (Story 9.2)

```typescript
// src/app/pages/LessonPlayer.tsx
import { generateSummary } from '@/ai/embeddings'

function SummaryPanel({ videoId }: { videoId: string }) {
  const [summary, setSummary] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleGenerateSummary = async () => {
    setLoading(true)
    try {
      // Coordinator handles worker routing + timeout
      const result = await generateSummary(videoId, {
        timeout: 30_000,  // 30s per NFR26
        stream: true,
        onChunk: (chunk) => setSummary(prev => prev + chunk)
      })
    } catch (error) {
      toast.error('Summary generation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handleGenerateSummary} disabled={loading}>
        Generate Summary
      </Button>
      {summary && <div className="prose">{summary}</div>}
    </div>
  )
}
```

#### 6.2 Q&A from Notes (Story 9.3)

```typescript
// src/app/components/notes/ChatPanel.tsx
import { searchNotes, askQuestion } from '@/ai/embeddings'

function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  const handleAskQuestion = async (question: string) => {
    setLoading(true)
    try {
      // 1. Search worker finds relevant notes via vector similarity
      const relevantNotes = await searchNotes(question, { topK: 5 })

      // 2. Edge function generates answer from context (RAG pattern)
      const answer = await askQuestion(question, relevantNotes)

      setMessages(prev => [
        ...prev,
        { role: 'user', content: question },
        { role: 'assistant', content: answer, sources: relevantNotes }
      ])
    } catch (error) {
      toast.error('Unable to answer. Try rephrasing your question.')
    } finally {
      setLoading(false)
    }
  }

  return <ChatInterface messages={messages} onSubmit={handleAskQuestion} />
}
```

---

### 7. Memory Management Strategy

**Goal:** Stay within NFR7 (≤50MB increase over 2-hour session).

#### 7.1 Model Weight Management

| Asset | Size | Storage | Lifecycle |
|-------|------|---------|-----------|
| Embedding model (all-MiniLM-L6-v2) | 23MB | Worker memory | Cached (1 load per session) |
| Inference model (Phi-3.5-mini) | 2.3GB | IndexedDB | Optional (user opt-in) |
| Vector index | ~1.5MB per 1000 notes | Worker memory | Loaded on-demand |

**Loading Strategy:**
- **Embedding model:** Load on first embedding request, keep in worker memory until idle timeout
- **Vector index:** Load into search worker only when Q&A panel opens, unload when closed
- **Inference model:** Only download if user enables "On-Device Inference" (default: edge function)

#### 7.2 Preventing Memory Leaks

```typescript
// src/ai/workers/coordinator.ts
class WorkerCoordinator {
  private idleTimers: Map<string, NodeJS.Timeout> = new Map()

  private scheduleIdleTermination(workerId: string) {
    // Clear existing timer
    const existingTimer = this.idleTimers.get(workerId)
    if (existingTimer) clearTimeout(existingTimer)

    // Schedule termination after 60s idle
    const timer = setTimeout(() => {
      const worker = this.pool.get(workerId)
      if (worker) {
        worker.terminate()
        this.pool.delete(workerId)
        this.idleTimers.delete(workerId)
        console.log(`[Coordinator] Terminated idle worker: ${workerId}`)
      }
    }, 60_000)

    this.idleTimers.set(workerId, timer)
  }
}
```

**Termination Triggers:**
- **Idle timeout:** 60s without requests (embedding/search workers)
- **Component unmount:** Chat panel closes → unload vector index
- **Tab visibility:** `document.hidden` → terminate all workers
- **Before unload:** `window.onbeforeunload` → cleanup

#### 7.3 Transferable Objects

Use `postMessage` with transfer list for large data (avoid cloning overhead).

```typescript
// GOOD: Transfer ArrayBuffer ownership to worker (zero-copy)
const buffer = new Float32Array(384).buffer
worker.postMessage({ type: 'search', queryVector: buffer }, [buffer])

// BAD: Clone ArrayBuffer (doubles memory usage)
worker.postMessage({ type: 'search', queryVector: buffer })
```

**Transferable Types:**
- `ArrayBuffer` (vectors, embeddings)
- `ImageBitmap` (frame capture for video summaries)
- `OffscreenCanvas` (future: visual analysis)

#### 7.4 OOM Handling

```typescript
// src/ai/workers/embedding.worker.ts
self.addEventListener('error', (event) => {
  console.error('[EmbeddingWorker] Unhandled error:', event)
  self.postMessage({
    type: 'error',
    error: 'Worker crashed due to memory pressure. Reloading...'
  })
  self.close()  // Terminate worker (coordinator will respawn on next request)
})
```

**Recovery Strategy:**
1. Worker crashes due to OOM
2. Coordinator detects unresponsive worker
3. Terminate crashed worker, remove from pool
4. Next request spawns fresh worker
5. Show user-friendly error: "AI features temporarily unavailable. Retrying..."

---

### 8. Worker-to-IndexedDB Communication

Workers CANNOT directly access IndexedDB (different context). Must use message passing.

#### 8.1 Pattern: Main Thread Proxy

```typescript
// src/ai/vector-store.ts (main thread)
import { db } from '@/db'

export async function loadVectorIndex(): Promise<Record<string, Float32Array>> {
  const embeddings = await db.embeddings.toArray()
  return Object.fromEntries(
    embeddings.map(e => [e.noteId, e.embedding])
  )
}

export async function saveEmbedding(noteId: string, embedding: Float32Array) {
  await db.embeddings.put({
    noteId,
    embedding,
    model: 'all-MiniLM-L6-v2',
    createdAt: new Date().toISOString()
  })
}

// Usage in coordinator
const vectorIndex = await loadVectorIndex()
await coordinator.executeTask('load-index', { vectors: vectorIndex })
```

**Flow:**
1. Main thread loads data from IndexedDB (Dexie.js)
2. Main thread sends data to worker via `postMessage`
3. Worker processes data in-memory
4. Worker returns results via `postMessage`
5. Main thread saves results to IndexedDB (if needed)

#### 8.2 Batch Operations

For auto-analysis (Story 9.7), process notes in batches to avoid blocking.

```typescript
// src/ai/embeddings.ts
export async function generateEmbeddingsForCourse(courseId: string) {
  const notes = await db.notes.where('courseId').equals(courseId).toArray()
  const BATCH_SIZE = 10  // Process 10 notes per batch

  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE)
    const texts = batch.map(n => n.content)

    // Generate embeddings in worker
    const { embeddings } = await coordinator.executeTask<EmbedResult>('embed', { texts })

    // Save to IndexedDB (main thread)
    await db.embeddings.bulkPut(
      embeddings.map((embedding, idx) => ({
        noteId: batch[idx].id,
        embedding,
        model: 'all-MiniLM-L6-v2',
        createdAt: new Date().toISOString()
      }))
    )

    // Yield to main thread between batches (keep UI responsive)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
```

---

### 9. Error Handling & Fallback

#### 9.1 Worker Spawn Failure

```typescript
// src/ai/workers/coordinator.ts
private getOrCreateWorker(task: WorkerTask): Worker {
  try {
    const worker = new Worker(
      new URL(`./embedding.worker.ts`, import.meta.url),
      { type: 'module' }
    )
    return worker
  } catch (error) {
    console.error('[Coordinator] Failed to spawn worker:', error)
    throw new Error('Web Workers not supported in this browser')
  }
}
```

**Fallback:**
- Detect worker support at app startup: `typeof Worker !== 'undefined'`
- If unsupported, disable AI features with banner: "AI features require a modern browser"
- All edge function features still work (summary, Q&A via API)

#### 9.2 Worker Timeout

```typescript
async executeTask<T>(task: WorkerTask, payload: unknown, options?: TaskOptions): Promise<T> {
  const timeout = options?.timeout ?? 30_000  // Default 30s
  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const result = await this.sendMessage<T>(task, payload, controller.signal)
    clearTimeout(timeoutId)
    return result
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again.')
    }
    throw error
  }
}
```

#### 9.3 Model Load Failure

```typescript
// src/ai/workers/embedding.worker.ts
async function initializePipeline() {
  try {
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { device: 'wasm' }
    )
  } catch (error) {
    console.error('[EmbeddingWorker] Model load failed:', error)
    throw new Error('Unable to load AI model. Check your internet connection.')
  }
}
```

**Fallback:**
- Show error toast with retry button
- Cache model files in browser (IndexedDB via Transformers.js)
- If repeated failures, fall back to edge function only (no embeddings)

---

### 10. Testing Strategy

#### 10.1 Unit Tests (Vitest)

```typescript
// src/ai/workers/__tests__/coordinator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { coordinator } from '../coordinator'

describe('WorkerCoordinator', () => {
  it('should spawn worker on first task', async () => {
    const result = await coordinator.executeTask('embed', { texts: ['test'] })
    expect(result.embeddings).toHaveLength(1)
  })

  it('should reuse worker for subsequent tasks', async () => {
    const spy = vi.spyOn(Worker.prototype, 'postMessage')
    await coordinator.executeTask('embed', { texts: ['test1'] })
    await coordinator.executeTask('embed', { texts: ['test2'] })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should timeout after 30s', async () => {
    await expect(
      coordinator.executeTask('embed', { texts: ['slow'] }, { timeout: 100 })
    ).rejects.toThrow('AI request timed out')
  })
})
```

#### 10.2 E2E Tests (Playwright)

```typescript
// tests/e2e/story-e09-s03-qa-chat.spec.ts
import { test, expect } from '@playwright/test'

test('Q&A chat uses embeddings for context retrieval', async ({ page }) => {
  // 1. Create notes with embeddings
  await seedNotes(page, [
    { id: 'note-1', content: 'React hooks are...' },
    { id: 'note-2', content: 'TypeScript generics...' }
  ])

  // 2. Open chat panel
  await page.getByRole('button', { name: /ask question/i }).click()

  // 3. Ask question
  await page.getByPlaceholder('Ask about your notes...').fill('What are React hooks?')
  await page.getByRole('button', { name: /send/i }).click()

  // 4. Verify answer cites relevant note
  await expect(page.getByText(/React hooks are/i)).toBeVisible()
  await expect(page.getByText(/Source: note-1/i)).toBeVisible()
})
```

#### 10.3 Performance Tests

```typescript
// tests/performance/embedding-speed.test.ts
import { test, expect } from 'vitest'
import { coordinator } from '@/ai/workers/coordinator'

test('embedding generation completes within 2s for 10 notes', async () => {
  const texts = Array.from({ length: 10 }, (_, i) => `Test note ${i}`)
  const start = performance.now()

  const { embeddings } = await coordinator.executeTask('embed', { texts })

  const duration = performance.now() - start
  expect(duration).toBeLessThan(2000)  // 2s budget
  expect(embeddings).toHaveLength(10)
})
```

---

### 11. Vite Configuration

Add worker support to Vite config.

```typescript
// vite.config.ts (add to existing config)
export default defineConfig({
  plugins: [react(), tailwindcss(), serveLocalMedia()],
  worker: {
    format: 'es',  // ES module workers
    plugins: () => [react()]  // Apply same transforms to workers
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // ... rest of config
})
```

**Vite Worker Features:**
- **Hot reload:** Worker code updates without full page reload
- **TypeScript:** Workers use same `tsconfig.json` as main app
- **Code splitting:** Workers bundled separately (not in main chunk)
- **Import syntax:** `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`

---

## Data Flow Examples

### Example 1: Video Summary (Story 9.2)

```
User clicks "Generate Summary"
  ↓
SummaryPanel.handleGenerateSummary()
  ↓
ai/embeddings.generateSummary(videoId)
  ↓
Edge function: POST /api/summarize { transcript, videoId }
  ↓
Vercel AI SDK: OpenAI API (gpt-4o-mini)
  ↓
Stream response chunks back to client
  ↓
SummaryPanel.onChunk() updates UI incrementally
  ↓
Summary complete (100-300 words)
```

**Workers NOT used** (edge function handles inference).

### Example 2: Q&A from Notes (Story 9.3)

```
User types question: "What are React hooks?"
  ↓
ChatPanel.handleAskQuestion(question)
  ↓
ai/embeddings.searchNotes(question, { topK: 5 })
  ↓
Coordinator: executeTask('embed', { texts: [question] })
  ↓
EmbeddingWorker: Generate 384-dim vector for question
  ↓
Coordinator: executeTask('search', { queryVector, topK: 5 })
  ↓
SearchWorker: Compute cosine similarity against all note embeddings
  ↓
Return top 5 most relevant notes (with scores)
  ↓
Edge function: POST /api/qa { question, context: [note1, note2, ...] }
  ↓
Vercel AI SDK: OpenAI API (gpt-4o-mini) with RAG context
  ↓
Stream answer back to client
  ↓
ChatPanel displays answer with note citations
```

**Workers used:** Embedding (query encoding) + Search (vector similarity).

### Example 3: Auto-Analysis on Import (Story 9.7)

```
User imports course folder
  ↓
CourseImport detects 50 videos
  ↓
Background task: generateEmbeddingsForCourse(courseId)
  ↓
Loop through notes in batches of 10
  ↓
For each batch:
  1. Coordinator: executeTask('embed', { texts: [batch] })
  2. EmbeddingWorker: Generate embeddings (10 × 384-dim vectors)
  3. Save to IndexedDB: db.embeddings.bulkPut([...])
  4. Update progress: "Analyzing... 20/50 notes"
  5. Yield to main thread: setTimeout(resolve, 100)
  ↓
All embeddings generated (background, non-blocking)
  ↓
Enable Q&A and note organization features for course
```

**Workers used:** Embedding (batch processing).

---

## Implementation Priorities

### Phase 1: Foundation (Week 1-2)

**Goal:** Get coordinator + embedding worker operational.

- [ ] Create `src/ai/workers/coordinator.ts` (worker pool manager)
- [ ] Create `src/ai/workers/embedding.worker.ts` (Transformers.js integration)
- [ ] Create `src/ai/embeddings.ts` (high-level API for React components)
- [ ] Add `embeddings` table to Dexie schema
- [ ] Add worker config to `vite.config.ts`
- [ ] Unit tests for coordinator (spawn, reuse, timeout)
- [ ] E2E smoke test (generate embedding, verify saved to IndexedDB)

**Validation:** Can generate embeddings for single note in <1s.

### Phase 2: Search + RAG (Week 3-4)

**Goal:** Enable Q&A from notes (Story 9.3).

- [ ] Create `src/ai/workers/search.worker.ts` (vector similarity search)
- [ ] Create `src/ai/vector-store.ts` (IndexedDB proxy for workers)
- [ ] Integrate edge function for Q&A (Vercel AI SDK)
- [ ] Build `ChatPanel` component with streaming responses
- [ ] E2E test: Ask question → verify correct note citations
- [ ] Performance test: Search 1000 notes in <200ms

**Validation:** Q&A chat returns relevant answers with note citations.

### Phase 3: Batch + Auto-Analysis (Week 5)

**Goal:** Enable auto-analysis on course import (Story 9.7).

- [ ] Implement batch embedding generation (10 notes per batch)
- [ ] Add progress UI: "Analyzing... 20/50 notes"
- [ ] Memory profiling: Verify ≤50MB increase during batch processing
- [ ] E2E test: Import course → verify all notes have embeddings
- [ ] Idle timeout: Terminate workers after 60s

**Validation:** Can analyze 100 notes in background without UI jank.

### Phase 4: Optional On-Device Inference (Week 6+)

**Goal:** Privacy-first mode with local LLM (optional).

- [ ] Create `src/ai/workers/inference.worker.ts` (WebLLM integration)
- [ ] Settings UI: Toggle "On-Device Inference" with consent dialog
- [ ] Model download progress bar (2.3GB Phi-3.5-mini)
- [ ] Fallback: If model load fails, revert to edge function
- [ ] Performance test: Summary generation in <10s on mid-range CPU

**Validation:** Users can run summaries locally without API calls.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Worker not supported** (old browsers) | AI features unavailable | Detect support at startup, disable with banner, edge functions still work |
| **Model download failure** (network) | Embeddings unavailable | Retry with exponential backoff, cache in IndexedDB, show error + retry UI |
| **OOM in worker** (large batch) | Worker crash | Batch size limit (10 notes), idle termination (60s), respawn on crash |
| **IndexedDB quota exceeded** (large corpus) | Cannot save embeddings | Show quota warning, offer to delete old embeddings, compress vectors |
| **Slow CPU** (inference 30s+) | User frustration | Show progress bar, allow cancel, suggest edge function mode |
| **Safari Web Worker bugs** | Intermittent failures | Comprehensive E2E tests on WebKit, fallback to edge function |

---

## API Reference

### Coordinator API

```typescript
import { coordinator } from '@/ai/workers/coordinator'

// Generate embeddings
const { embeddings } = await coordinator.executeTask<EmbedResult>('embed', {
  texts: ['note content 1', 'note content 2']
})

// Search for similar notes
const { results } = await coordinator.executeTask<SearchResult>('search', {
  queryVector: embeddingVector,
  topK: 5
})

// Cleanup (on app unmount)
coordinator.terminate()
```

### High-Level APIs

```typescript
import { generateSummary, searchNotes, askQuestion } from '@/ai/embeddings'

// Video summary (edge function)
const summary = await generateSummary(videoId, {
  stream: true,
  onChunk: (chunk) => console.log(chunk)
})

// Search notes by semantic similarity
const notes = await searchNotes('What are React hooks?', { topK: 5 })

// Q&A with RAG context
const answer = await askQuestion('What are React hooks?', notes)
```

---

## References

- **Transformers.js:** https://huggingface.co/docs/transformers.js
- **Vercel AI SDK:** https://sdk.vercel.ai/docs
- **WebLLM:** https://webllm.mlc.ai
- **Web Workers MDN:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- **Vite Worker Guide:** https://vitejs.dev/guide/features.html#web-workers
- **IndexedDB Best Practices:** https://web.dev/indexeddb-best-practices/

---

## Appendices

### Appendix A: Model Selection

| Model | Size | Dimensions | Use Case | Inference Speed |
|-------|------|------------|----------|-----------------|
| all-MiniLM-L6-v2 | 23MB | 384 | Embeddings (selected) | 50ms per text |
| all-mpnet-base-v2 | 420MB | 768 | Higher quality (future) | 200ms per text |
| Phi-3.5-mini | 2.3GB | N/A | On-device inference | 5-10s per summary |
| gpt-4o-mini | Cloud | N/A | Edge function (default) | 2-5s per summary |

**Selection Rationale:**
- **all-MiniLM-L6-v2:** Best balance of speed (50ms) and quality (384-dim sufficient for note corpus <10k)
- **Phi-3.5-mini:** Smallest viable on-device LLM, Q4 quantization fits in 4GB RAM
- **gpt-4o-mini:** Default mode for best quality/speed trade-off via edge function

### Appendix B: Memory Budget

| Component | Memory | Lifecycle | Notes |
|-----------|--------|-----------|-------|
| Embedding model | 23MB | Session | Loaded once, reused |
| Vector index (1000 notes) | 1.5MB | On-demand | Loaded when chat opens |
| Search worker | 5MB | Idle timeout | Terminated after 60s |
| Inference model | 2.3GB | Optional | Only if user enables |
| IndexedDB embeddings | 1.5MB per 1000 | Persistent | Disk storage, not RAM |

**Total (Default Mode):** ~30MB
**Total (On-Device Inference):** ~2.35GB (user must consent)

### Appendix C: Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Web Workers | ✅ 4+ | ✅ 3.5+ | ✅ 4+ | ✅ 12+ |
| ES Module Workers | ✅ 80+ | ✅ 114+ | ✅ 15+ | ✅ 80+ |
| Transferable Objects | ✅ 21+ | ✅ 18+ | ✅ 6+ | ✅ 79+ |
| WebAssembly | ✅ 57+ | ✅ 52+ | ✅ 11+ | ✅ 79+ |
| WebGPU (optional) | ✅ 113+ | ❌ | ❌ | ✅ 113+ |

**Minimum Support:** Chrome 80+, Firefox 114+, Safari 15+, Edge 80+

---

**End of Document**

# Web Worker Implementation Guide - Quick Reference

**Epic:** Epic 9 - AI-Powered Learning Assistant
**Architecture Document:** [web-worker-architecture.md](./web-worker-architecture.md)

---

## Quick Start

### 1. Install Dependencies

```bash
# Transformers.js (on-device embeddings)
npm install @xenova/transformers

# Optional: WebLLM for on-device inference
npm install @langchain/community
```

### 2. File Checklist

Created files (samples):
- ✅ `src/ai/workers/types.ts` - Message protocol types
- ✅ `src/ai/workers/coordinator.ts` - Worker pool manager
- ✅ `src/ai/workers/embedding.worker.ts` - Embedding generation (MOCK)
- ✅ `src/lib/vectorMath.ts` - Vector similarity functions
- ✅ `src/ai/workers/__tests__/coordinator.test.ts` - Unit tests

Remaining files (implement during Epic 9):
- ⬜ `src/ai/workers/search.worker.ts` - Vector similarity search
- ⬜ `src/ai/workers/inference.worker.ts` - Optional on-device LLM
- ⬜ `src/ai/vector-store.ts` - IndexedDB vector storage
- ⬜ `src/ai/embeddings.ts` - High-level API for React components
- ⬜ `src/db/schema.ts` - Add embeddings table (version 9)

### 3. Update Vite Config

Add worker support to `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss(), serveLocalMedia()],
  worker: {
    format: 'es',  // ES module workers
    plugins: () => [react()]  // Apply same transforms
  },
  // ... rest of config
})
```

### 4. Add Embeddings Table to Dexie

```typescript
// src/db/schema.ts
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

---

## Usage Examples

### Example 1: Generate Embeddings

```typescript
import { generateEmbeddings } from '@/ai/workers/coordinator'

// Single text
const [embedding] = await generateEmbeddings(['My note content'])
console.log(embedding.length) // 384

// Batch (10 notes)
const texts = notes.map(n => n.content)
const embeddings = await generateEmbeddings(texts)
```

### Example 2: Search Similar Notes

```typescript
import { searchSimilarNotes, generateEmbeddings } from '@/ai/workers/coordinator'
import { loadVectorIndex } from '@/ai/vector-store'

// 1. Load vector index into search worker (once per session)
const vectorIndex = await loadVectorIndex()
await coordinator.executeTask('load-index', { vectors: vectorIndex })

// 2. Search for similar notes
const [queryEmbedding] = await generateEmbeddings(['What are React hooks?'])
const results = await searchSimilarNotes(queryEmbedding, 5)

// results = [
//   { noteId: 'note-123', score: 0.92 },
//   { noteId: 'note-456', score: 0.87 },
//   ...
// ]
```

### Example 3: React Component Integration

```typescript
// src/app/components/notes/ChatPanel.tsx
import { useState } from 'react'
import { searchSimilarNotes, generateEmbeddings } from '@/ai/workers/coordinator'
import { db } from '@/db'

function ChatPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAsk = async () => {
    setLoading(true)
    try {
      // 1. Generate embedding for question
      const [queryVector] = await generateEmbeddings([question])

      // 2. Find similar notes (vector search in worker)
      const results = await searchSimilarNotes(queryVector, 5)

      // 3. Load full note content
      const noteIds = results.map(r => r.noteId)
      const notes = await db.notes.bulkGet(noteIds)

      // 4. Call edge function with context (RAG)
      const response = await fetch('/api/qa', {
        method: 'POST',
        body: JSON.stringify({ question, context: notes })
      })

      const { answer } = await response.json()
      setAnswer(answer)
    } catch (error) {
      console.error('Q&A failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input value={question} onChange={e => setQuestion(e.target.value)} />
      <button onClick={handleAsk} disabled={loading}>Ask</button>
      {answer && <div>{answer}</div>}
    </div>
  )
}
```

---

## Architecture Overview (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│                         MAIN THREAD                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  React Component (ChatPanel, SummaryPanel, etc.)           │
│         ↓                                                   │
│  High-Level API (embeddings.ts)                            │
│         ↓                                                   │
│  Coordinator (coordinator.ts)                              │
│         ↓                                                   │
│  ┌──────────────┬──────────────┬──────────────┐           │
│  │ Worker Pool  │ Worker Pool  │ Worker Pool  │           │
│  │   Slot 1     │   Slot 2     │   Slot 3     │           │
│  └──────┬───────┴──────┬───────┴──────┬───────┘           │
│         │              │              │                    │
└─────────┼──────────────┼──────────────┼────────────────────┘
          │              │              │
          ↓              ↓              ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   WORKER 1  │  │   WORKER 2  │  │   WORKER 3  │
│             │  │             │  │             │
│ embedding   │  │   search    │  │  inference  │
│  .worker    │  │   .worker   │  │   .worker   │
│             │  │             │  │             │
│ Transforms  │  │  Vector     │  │   WebLLM    │
│    .js      │  │  Search     │  │  (optional) │
│             │  │             │  │             │
│  23MB model │  │  In-memory  │  │  2.3GB model│
│  (cached)   │  │   index     │  │  (opt-in)   │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Message Flow

```
1. User Action
   ↓
2. React Component calls high-level API
   ↓
3. Coordinator.executeTask(type, payload, options)
   ↓
4. Coordinator selects/spawns worker
   ↓
5. postMessage({ requestId, type, payload })
   ↓
6. Worker processes task (embedding, search, inference)
   ↓
7. postMessage({ requestId, type: 'success', result })
   ↓
8. Coordinator resolves promise
   ↓
9. React Component updates UI
```

---

## Memory Management

### Budget Breakdown

| Component | Memory | Lifecycle | Notes |
|-----------|--------|-----------|-------|
| Embedding model | 23MB | Session | Loaded once, cached |
| Vector index (1000 notes) | 1.5MB | On-demand | Loaded when chat opens |
| Search worker | 5MB | Idle timeout | Terminated after 60s |
| Inference model | 2.3GB | Optional | Only if user enables |
| **Total (Default)** | **~30MB** | | Well within NFR7 (≤50MB) |
| **Total (On-Device)** | **~2.35GB** | | User must consent |

### Idle Termination

Workers automatically terminate after 60 seconds of inactivity:

```typescript
// Automatic in coordinator
scheduleIdleTermination(workerId) {
  setTimeout(() => {
    worker.terminate()
    pool.delete(workerId)
    console.log(`Terminated idle worker: ${workerId}`)
  }, 60_000)
}
```

### Manual Cleanup

```typescript
// On component unmount
useEffect(() => {
  return () => coordinator.terminate()
}, [])

// On tab visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    coordinator.terminate()
  }
})
```

---

## Error Handling Patterns

### Timeout (30s default)

```typescript
try {
  const embeddings = await generateEmbeddings(texts, { timeout: 30_000 })
} catch (error) {
  if (error.message.includes('timed out')) {
    toast.error('AI request timed out. Please try again.')
  }
}
```

### Worker Crash (OOM, unhandled error)

```typescript
// Coordinator automatically respawns crashed workers
// User sees error toast, next request succeeds
try {
  const embeddings = await generateEmbeddings(texts)
} catch (error) {
  if (error.message.includes('crashed')) {
    toast.error('AI features temporarily unavailable. Retrying...')
    // Retry logic (automatic in coordinator)
  }
}
```

### Unsupported Browser

```typescript
// Detect worker support at app startup
if (typeof Worker === 'undefined') {
  toast.warning('AI features require a modern browser')
  // Disable AI features, fall back to edge function only
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// src/ai/workers/__tests__/coordinator.test.ts
import { describe, it, expect } from 'vitest'
import { generateEmbeddings } from '../coordinator'

describe('generateEmbeddings', () => {
  it('should generate 384-dim vectors', async () => {
    const embeddings = await generateEmbeddings(['test'])
    expect(embeddings[0].length).toBe(384)
  })

  it('should handle batch requests', async () => {
    const embeddings = await generateEmbeddings(['a', 'b', 'c'])
    expect(embeddings).toHaveLength(3)
  })

  it('should timeout after 30s', async () => {
    await expect(
      generateEmbeddings(['slow'], { timeout: 100 })
    ).rejects.toThrow('timed out')
  })
})
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/story-e09-s03-qa-chat.spec.ts
import { test, expect } from '@playwright/test'

test('Q&A uses embeddings for context', async ({ page }) => {
  await seedNotes(page, [
    { id: 'note-1', content: 'React hooks are...' }
  ])

  await page.getByPlaceholder('Ask question...').fill('What are hooks?')
  await page.getByRole('button', { name: /send/i }).click()

  await expect(page.getByText(/React hooks are/i)).toBeVisible()
  await expect(page.getByText(/Source: note-1/i)).toBeVisible()
})
```

---

## Performance Benchmarks

### Target Performance (NFR)

| Operation | Target | Notes |
|-----------|--------|-------|
| Single embedding | <100ms | 1 text → 384-dim vector |
| Batch embedding (10) | <500ms | 10 texts → 10 vectors |
| Vector search (1000 notes) | <50ms | Cosine similarity all pairs |
| Worker spawn | <200ms | First request only (cached after) |
| Memory overhead | ≤50MB | Over 2-hour session (NFR7) |

### Actual Performance (MOCK)

Current mock implementation:
- Single embedding: ~10ms (instant, no real model)
- Batch (10): ~50ms (10ms base + 5ms per text)
- Vector search: Not implemented yet
- Worker spawn: <50ms (native Worker API)

**Production performance will be slower** (Transformers.js adds ~50-100ms per text).

---

## Implementation Phases

### ✅ Phase 1: Foundation (Week 1-2) - COMPLETED

- [x] Create coordinator.ts (worker pool manager)
- [x] Create embedding.worker.ts (MOCK implementation)
- [x] Create types.ts (message protocol)
- [x] Create vectorMath.ts (similarity functions)
- [x] Unit tests for coordinator
- [x] Architecture documentation

### ⬜ Phase 2: Embeddings (Week 3)

- [ ] Replace MOCK with Transformers.js
- [ ] Add embeddings table to Dexie
- [ ] Implement vector-store.ts (IndexedDB proxy)
- [ ] Performance testing (50ms per text)
- [ ] E2E smoke test (generate + save embedding)

### ⬜ Phase 3: Search + RAG (Week 4-5)

- [ ] Create search.worker.ts
- [ ] Load vector index into worker memory
- [ ] Implement searchSimilarNotes API
- [ ] Integrate with ChatPanel (Story 9.3)
- [ ] E2E test: Q&A with note citations

### ⬜ Phase 4: Batch + Auto-Analysis (Week 6)

- [ ] Implement batch embedding (10 notes per batch)
- [ ] Progress UI: "Analyzing... 20/50 notes"
- [ ] Auto-trigger on course import (Story 9.7)
- [ ] Memory profiling (≤50MB increase)
- [ ] E2E test: Import course → verify embeddings

### ⬜ Phase 5: Optional On-Device Inference (Week 7+)

- [ ] Create inference.worker.ts (WebLLM)
- [ ] Settings toggle: "On-Device Inference"
- [ ] Model download progress (2.3GB)
- [ ] Streaming summary generation
- [ ] Fallback to edge function if unavailable

---

## Troubleshooting

### Issue: Worker fails to spawn

**Symptom:** `TypeError: Worker is not a constructor`

**Cause:** Browser does not support Web Workers (very old browser)

**Fix:** Detect support and fall back to edge function only:

```typescript
if (typeof Worker === 'undefined') {
  console.warn('Web Workers not supported')
  // Disable AI features, show banner
}
```

### Issue: Worker times out after 30s

**Symptom:** `Error: AI request timed out`

**Cause:** Model loading is slow (first request only)

**Fix:** Increase timeout for model initialization:

```typescript
// First request only
await generateEmbeddings(['warmup'], { timeout: 60_000 })
```

### Issue: Memory leak (workers not terminating)

**Symptom:** Memory usage increases over time

**Cause:** Idle termination not working (timer cleared prematurely)

**Fix:** Verify idle timer is set:

```typescript
coordinator.getStatus()
// Check workers.idle value (should be <60s)
```

### Issue: Embeddings not persisted to IndexedDB

**Symptom:** Vector index empty on page reload

**Cause:** `db.embeddings.put()` not called after generation

**Fix:** Ensure embeddings are saved after generation:

```typescript
const embeddings = await generateEmbeddings(texts)
await db.embeddings.bulkPut(
  embeddings.map((embedding, i) => ({
    noteId: notes[i].id,
    embedding,
    model: 'all-MiniLM-L6-v2',
    createdAt: new Date().toISOString()
  }))
)
```

---

## Next Steps

1. **Test mock implementation:**
   ```bash
   npm run test src/ai/workers/__tests__/coordinator.test.ts
   ```

2. **Integrate Transformers.js:**
   - Uncomment production code in `embedding.worker.ts`
   - Install `@xenova/transformers`
   - Test model loading (first request ~3s, cached after)

3. **Create search worker:**
   - Implement `search.worker.ts`
   - Add `loadVectorIndex()` to vector-store.ts
   - Test cosine similarity search

4. **Build Q&A chat:**
   - Create ChatPanel component (Story 9.3)
   - Integrate coordinator API
   - Connect to edge function for RAG

---

## Resources

- **Main Architecture Doc:** [web-worker-architecture.md](./web-worker-architecture.md)
- **Epic 9 Stories:** [epics.md](./epics.md#epic-9-ai-powered-learning-assistant)
- **Transformers.js Docs:** https://huggingface.co/docs/transformers.js
- **Web Workers MDN:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- **Vite Worker Guide:** https://vitejs.dev/guide/features.html#web-workers

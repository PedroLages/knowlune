# Epic 9 Vector Store Implementation Handoff

**Story**: E09-S03 - Embedding Pipeline & Vector Store
**Implementation Approach**: Brute force k-NN (NOT HNSW)
**Status**: ✅ Ready for implementation
**Estimated Effort**: 12-16 hours

---

## What You're Building

A semantic search system for LevelUp that:
1. Generates 384-dimensional embeddings from text (notes, videos, courses)
2. Stores embeddings in IndexedDB (Dexie)
3. Searches embeddings using brute force k-NN with cosine similarity
4. Returns semantically similar content in <100ms

**Example use case**: User types "React hooks best practices" → finds all notes/videos about hooks, even if they don't contain exact keywords.

---

## Architecture Decision: Brute Force k-NN

**Why NOT HNSW?**
- Custom HNSW failed 4 bug fix attempts (6.2% recall vs 95% target)
- 3 hours invested, 0 progress
- Complex implementation (700+ lines) with multiple bugs

**Why Brute Force?**
- ✅ 100% recall (exact search, no approximation errors)
- ✅ 10.27ms latency @ 10K vectors (10× faster than 100ms target)
- ✅ 14.65MB memory @ 10K vectors (well under budget)
- ✅ Zero bugs, production-ready immediately
- ✅ Simple implementation (~200 lines)

**Migration path**: EdgeVec library at 6-month checkpoint IF >50K vectors OR >200ms latency

---

## Key Files

### Already Implemented ✅

**1. `src/lib/vectorSearch.ts`** - BruteForceVectorStore class
- Pure TypeScript, zero dependencies
- Linear scan k-NN with cosine similarity
- API: `insert()`, `search()`, `remove()`, `clear()`, `getStats()`

**2. `experiments/vector-db-benchmark/brute-force-validation.mjs`**
- Validation showing 100% recall, 10.27ms latency
- Use this as reference for performance expectations

### You Need to Implement

**3. `src/lib/db.ts`** - Add Dexie schema v3
- Add `vectorEmbeddings` table for IndexedDB persistence

**4. `src/lib/vectorStoreLoader.ts`** - NEW FILE
- Load embeddings from IndexedDB on app init
- Populate BruteForceVectorStore in-memory cache

**5. `src/lib/embeddingGenerator.ts`** - NEW FILE (placeholder for E09-S01)
- Will use Transformers.js `all-MiniLM-L6-v2` model
- For E09-S03, just create interface/stub

**6. Update story components** - Integrate vector search into note search UI
- See E09-S03 acceptance criteria for specific requirements

---

## Implementation Steps

### Step 1: Add Dexie Schema (30-45 min)

**File**: `src/lib/db.ts`

**Schema addition**:
```typescript
// Add to Dexie schema
export interface VectorEmbedding {
  id: string              // Composite key: `${type}:${sourceId}`
  type: 'note' | 'video' | 'course'
  sourceId: string        // Original note/video/course ID
  text: string            // Original text (for debugging/regeneration)
  embedding: number[]     // 384-dimensional Float32Array converted to number[]
  createdAt: string       // ISO timestamp
  updatedAt?: string      // ISO timestamp (for regeneration tracking)
}

// In Dexie class constructor
class ElearningDB extends Dexie {
  notes!: Table<Note>
  courses!: Table<Course>
  studySessions!: Table<StudySession>
  // ... existing tables
  vectorEmbeddings!: Table<VectorEmbedding>  // NEW

  constructor() {
    super('ElearningDB')

    // Version 3: Add vectorEmbeddings table (Epic 9)
    this.version(3).stores({
      notes: 'id, courseId, videoId, *tags, createdAt',
      courses: 'id, title, category, status, createdAt',
      studySessions: 'id, courseId, startTime, endTime, studyDate',
      bookmarks: 'id, courseId, videoId, timestamp, createdAt',
      // ... other existing stores
      vectorEmbeddings: 'id, type, sourceId, createdAt'  // NEW
    })

    this.notes = this.table('notes')
    this.courses = this.table('courses')
    // ... existing table assignments
    this.vectorEmbeddings = this.table('vectorEmbeddings')  // NEW
  }
}
```

**Migration considerations**:
- Version 3 schema will auto-migrate existing data
- `vectorEmbeddings` table starts empty (populated during E09-S01/S02)
- No data loss for existing notes/courses

**Testing**: Verify IndexedDB schema in DevTools → Application → IndexedDB → ElearningDB → Version 3

---

### Step 2: Create Vector Store Loader (1-1.5 hours)

**File**: `src/lib/vectorStoreLoader.ts` (NEW)

**Purpose**: Load embeddings from IndexedDB into in-memory BruteForceVectorStore on app startup

**Implementation**:
```typescript
import { BruteForceVectorStore } from './vectorSearch'
import { db } from './db'

/**
 * Initialize vector store by loading embeddings from IndexedDB
 *
 * Call this on app startup (in main.tsx or App.tsx useEffect)
 *
 * @returns Populated BruteForceVectorStore ready for search
 */
export async function initializeVectorStore(): Promise<BruteForceVectorStore> {
  const store = new BruteForceVectorStore(384) // all-MiniLM-L6-v2 dimensions

  try {
    // Load all embeddings from IndexedDB
    const embeddings = await db.vectorEmbeddings.toArray()

    console.log(`[VectorStore] Loading ${embeddings.length} embeddings...`)

    // Populate in-memory store
    for (const emb of embeddings) {
      store.insert(emb.id, emb.embedding)
    }

    const stats = store.getStats()
    console.log(`[VectorStore] Loaded ${stats.count} vectors (${stats.memoryMB}MB)`)

    return store
  } catch (error) {
    console.error('[VectorStore] Failed to load embeddings:', error)
    // Return empty store (graceful degradation)
    return store
  }
}

/**
 * Update vector store with new embedding
 *
 * Call this when a note/video/course is created or updated
 *
 * @param store - In-memory vector store
 * @param id - Unique embedding ID
 * @param embedding - 384-dimensional vector
 */
export async function addEmbedding(
  store: BruteForceVectorStore,
  id: string,
  type: 'note' | 'video' | 'course',
  sourceId: string,
  text: string,
  embedding: number[]
): Promise<void> {
  // Add to IndexedDB
  await db.vectorEmbeddings.put({
    id,
    type,
    sourceId,
    text,
    embedding,
    createdAt: new Date().toISOString()
  })

  // Add to in-memory store
  store.insert(id, embedding)
}

/**
 * Remove embedding from vector store
 *
 * Call this when a note/video/course is deleted
 *
 * @param store - In-memory vector store
 * @param id - Unique embedding ID
 */
export async function removeEmbedding(
  store: BruteForceVectorStore,
  id: string
): Promise<void> {
  // Remove from IndexedDB
  await db.vectorEmbeddings.delete(id)

  // Remove from in-memory store
  store.remove(id)
}
```

**Usage in App.tsx**:
```typescript
import { initializeVectorStore } from '@/lib/vectorStoreLoader'
import { BruteForceVectorStore } from '@/lib/vectorSearch'

export function App() {
  const [vectorStore, setVectorStore] = useState<BruteForceVectorStore | null>(null)

  useEffect(() => {
    // Initialize vector store on app startup
    initializeVectorStore().then(store => {
      setVectorStore(store)
    })
  }, [])

  // ... rest of app
}
```

---

### Step 3: Create Embedding Generator Stub (30 min)

**File**: `src/lib/embeddingGenerator.ts` (NEW)

**Purpose**: Placeholder for E09-S01 (Transformers.js integration)

**Stub implementation**:
```typescript
/**
 * Generate embedding from text using Transformers.js
 *
 * Model: all-MiniLM-L6-v2 (384 dimensions)
 *
 * NOTE: This is a STUB for E09-S03. Full implementation in E09-S01.
 *
 * @param text - Input text to embed
 * @returns 384-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // TODO (E09-S01): Replace with Transformers.js implementation
  // For now, return mock embedding for testing

  console.warn('[EmbeddingGenerator] Using MOCK embedding (implement in E09-S01)')

  // Return random normalized vector for testing
  const dimensions = 384
  const vector = new Array(dimensions).fill(0).map(() => Math.random() - 0.5)

  // Normalize to unit vector (required for cosine similarity)
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  return vector.map(val => val / norm)
}

/**
 * Batch generate embeddings for multiple texts
 *
 * @param texts - Array of input texts
 * @returns Array of 384-dimensional embedding vectors
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  // Process in batches of 32 for efficiency (E09-S01 optimization)
  const embeddings: number[][] = []

  for (const text of texts) {
    const embedding = await generateEmbedding(text)
    embeddings.push(embedding)
  }

  return embeddings
}

/**
 * Check if embedding generator is initialized
 *
 * @returns true if Transformers.js model loaded
 */
export function isEmbeddingGeneratorReady(): boolean {
  // TODO (E09-S01): Check if Transformers.js model is loaded
  return false // Always false until E09-S01
}
```

**Why stub?**
- E09-S03 focuses on vector STORE (IndexedDB + search)
- E09-S01 implements embedding GENERATION (Transformers.js)
- Stub allows E2E tests to use mock embeddings

---

### Step 4: Integrate with Note Search UI (2-3 hours)

**File**: Update existing note search component (find in `src/app/pages/` or `src/app/components/`)

**Requirements** (from E09-S03 acceptance criteria):
- Add "Semantic Search" toggle to note search UI
- When enabled, use `vectorStore.search()` instead of text search
- Display results with similarity score
- Fallback to text search if no embeddings exist

**Example integration**:
```typescript
import { BruteForceVectorStore } from '@/lib/vectorSearch'
import { generateEmbedding } from '@/lib/embeddingGenerator'

interface NoteSearchProps {
  vectorStore: BruteForceVectorStore | null
}

export function NoteSearch({ vectorStore }: NoteSearchProps) {
  const [query, setQuery] = useState('')
  const [useSemanticSearch, setUseSemanticSearch] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])

  async function handleSearch() {
    if (useSemanticSearch && vectorStore) {
      // Semantic search
      const queryEmbedding = await generateEmbedding(query)
      const vectorResults = vectorStore.search(queryEmbedding, 10)

      // Map vector IDs back to notes
      const noteResults = await Promise.all(
        vectorResults.map(async (result) => {
          const [type, sourceId] = result.id.split(':')
          if (type === 'note') {
            const note = await db.notes.get(sourceId)
            return { note, similarity: result.similarity }
          }
          return null
        })
      )

      setResults(noteResults.filter(r => r !== null))
    } else {
      // Text search fallback
      const notes = await db.notes
        .filter(note => note.text.includes(query))
        .toArray()

      setResults(notes.map(note => ({ note, similarity: 1.0 })))
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes..."
      />

      <label>
        <input
          type="checkbox"
          checked={useSemanticSearch}
          onChange={(e) => setUseSemanticSearch(e.target.checked)}
          disabled={!vectorStore || vectorStore.size === 0}
        />
        Semantic Search
        {vectorStore && vectorStore.size > 0 && ` (${vectorStore.size} embeddings)`}
      </label>

      <button onClick={handleSearch}>Search</button>

      {results.map(({ note, similarity }) => (
        <div key={note.id}>
          <h3>{note.title}</h3>
          <p>{note.text}</p>
          <span>Similarity: {(similarity * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}
```

---

### Step 5: Write E2E Tests (1.5-2 hours)

**File**: `tests/e2e/story-e09-s03.spec.ts` (NEW)

**Test coverage**:
1. IndexedDB schema migration to v3
2. Vector store loads embeddings on app startup
3. Adding embedding persists to IndexedDB and in-memory store
4. Removing embedding deletes from both stores
5. Semantic search returns results ordered by similarity
6. Fallback to text search when no embeddings exist

**Example test**:
```typescript
import { test, expect } from '@playwright/test'
import { seedVectorEmbeddings } from '../support/helpers/indexeddb-seed'

test.describe('E09-S03: Embedding Pipeline & Vector Store', () => {
  test('semantic search returns results ordered by similarity', async ({ page }) => {
    // Seed mock embeddings for testing
    await seedVectorEmbeddings(page, [
      { id: 'note:1', type: 'note', sourceId: '1', text: 'React hooks tutorial', embedding: [0.1, 0.2, ...] },
      { id: 'note:2', type: 'note', sourceId: '2', text: 'Vue composition API', embedding: [0.9, 0.8, ...] }
    ])

    await page.goto('/notes')

    // Enable semantic search
    await page.getByLabel('Semantic Search').check()

    // Search for "React hooks"
    await page.getByPlaceholder('Search notes...').fill('React hooks')
    await page.getByRole('button', { name: 'Search' }).click()

    // Verify results ordered by similarity
    const results = page.getByTestId('search-result')
    await expect(results).toHaveCount(2)

    const firstResult = results.nth(0)
    await expect(firstResult).toContainText('React hooks tutorial')
    await expect(firstResult).toContainText('Similarity: ')
  })
})
```

---

## Performance Expectations

Based on validation (`experiments/vector-db-benchmark/brute-force-validation.mjs`):

| Metric | 1K vectors | 5K vectors | 10K vectors | Target |
|--------|------------|------------|-------------|--------|
| p50 latency | 1.02ms | 5.11ms | 10.27ms | <100ms ✅ |
| p95 latency | 1.10ms | 5.45ms | 11.11ms | <150ms ✅ |
| Memory | 1.46MB | 7.32MB | 14.65MB | <100MB ✅ |
| Recall | 100% | 100% | 100% | ≥95% ✅ |

**Key insight**: Brute force is 10× faster than target for 10K vectors!

---

## Common Pitfalls & Solutions

### Pitfall 1: Embedding Dimensions Mismatch

**Problem**: Vector has wrong number of dimensions (not 384)

**Solution**:
```typescript
if (embedding.length !== 384) {
  throw new Error(`Expected 384 dimensions, got ${embedding.length}`)
}
```

### Pitfall 2: Non-Normalized Vectors

**Problem**: Cosine similarity requires unit vectors (magnitude = 1)

**Solution**: Normalize in `generateEmbedding()`:
```typescript
const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
return vector.map(val => val / norm)
```

### Pitfall 3: IndexedDB Out of Sync with In-Memory Store

**Problem**: Embedding added to IndexedDB but not in-memory store

**Solution**: Always update BOTH in `addEmbedding()` helper

### Pitfall 4: Large Batch Loading on Startup

**Problem**: Loading 100K embeddings blocks UI

**Solution**: Show loading indicator:
```typescript
const [isLoadingVectorStore, setIsLoadingVectorStore] = useState(true)

useEffect(() => {
  initializeVectorStore().then(store => {
    setVectorStore(store)
    setIsLoadingVectorStore(false)
  })
}, [])
```

---

## Migration Path (Future)

At 6-month production checkpoint, IF >50K vectors OR >200ms latency:

**Replace** `BruteForceVectorStore` with `EdgeVecStore` (same interface):
```typescript
import { EdgeVecStore } from '@edgevec/wasm'

// Drop-in replacement, zero code changes
const store = new EdgeVecStore(384)
```

See `docs/research/epic-9-vector-migration-triggers.md` for migration guide.

---

## References

**Implementation**:
- `src/lib/vectorSearch.ts` - BruteForceVectorStore (DONE)
- `experiments/vector-db-benchmark/brute-force-validation.mjs` - Validation (DONE)

**Documentation**:
- `docs/plans/epic-9-pivot-to-brute-force-vector-search.md` - Full pivot plan
- `docs/research/epic-9-hnsw-postmortem.md` - Why custom HNSW failed
- `docs/research/epic-9-vector-migration-triggers.md` - Migration decision framework

**Story File**:
- `docs/implementation-artifacts/epics/epic-9.md` - E09-S03 acceptance criteria

---

## Questions?

**Q: Why not use a library like vectra or hnswlib?**
A: Custom HNSW failed 4 fix attempts. Brute force is simpler, faster to implement, and exceeds requirements.

**Q: Will brute force scale to 100K vectors?**
A: Yes, estimated 100-200ms @ 100K (still acceptable). Migrate to EdgeVec if latency complaints.

**Q: How do I test semantic search without real embeddings?**
A: Use mock embeddings from `generateEmbedding()` stub. E09-S01 adds real Transformers.js.

**Q: What if IndexedDB migration fails?**
A: Dexie auto-handles migrations. If issues, clear IndexedDB in DevTools and refresh.

---

*Handoff document created: 2026-03-10*
*Ready for E09-S03 implementation*

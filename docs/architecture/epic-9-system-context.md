# Epic 9 System Context Diagram

**Visual Overview of AI Infrastructure**
**Date:** 2026-03-10

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LevelUp Application                                │
│                        (Personal Learning Platform)                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser Runtime                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Main Thread                                    │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │  ┌──────────────────┐        ┌──────────────────┐                    │  │
│  │  │  React UI Layer  │        │  State Layer     │                    │  │
│  │  │  - Pages         │◄──────►│  - Zustand       │                    │  │
│  │  │  - Components    │        │  - Stores        │                    │  │
│  │  │  - Hooks         │        │                  │                    │  │
│  │  └──────────┬───────┘        └────────┬─────────┘                    │  │
│  │             │                         │                               │  │
│  │             │ AI requests             │ State updates                │  │
│  │             ▼                         ▼                               │  │
│  │  ┌─────────────────────────────────────────────────┐                 │  │
│  │  │        WorkerCoordinator (Singleton)            │                 │  │
│  │  │  - Task routing & load balancing                │                 │  │
│  │  │  - Message protocol (requestId tracking)        │                 │  │
│  │  │  - Worker lifecycle (spawn/idle/terminate)      │                 │  │
│  │  │  - Timeout & error handling                     │                 │  │
│  │  │  - Memory monitoring (3GB ceiling)              │                 │  │
│  │  └────────┬────────────────────────────────────────┘                 │  │
│  │           │                                                           │  │
│  │           │ postMessage({ requestId, type, payload })                │  │
│  │           │                                                           │  │
│  └───────────┼───────────────────────────────────────────────────────────┘  │
│              │                                                               │
│  ┌───────────▼───────────────────────────────────────────────────────────┐  │
│  │                         Worker Threads                                 │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐        │  │
│  │  │  Embedding   │      │   Search     │      │  Inference   │        │  │
│  │  │   Worker     │      │   Worker     │      │   Worker     │        │  │
│  │  ├──────────────┤      ├──────────────┤      ├──────────────┤        │  │
│  │  │              │      │              │      │              │        │  │
│  │  │ Transformers │      │ MeMemo HNSW  │      │   WebLLM     │        │  │
│  │  │ .js (WASM)   │      │ Vector Index │      │  (WebGPU)    │        │  │
│  │  │              │      │              │      │              │        │  │
│  │  │ Model:       │      │ Algorithms:  │      │ Models:      │        │  │
│  │  │ all-MiniLM-  │      │ - HNSW graph │      │ - Llama 3.2  │        │  │
│  │  │ L6-v2        │      │ - Cosine     │      │   1B         │        │  │
│  │  │ (23MB)       │      │   similarity │      │ - Phi-3.5    │        │  │
│  │  │              │      │              │      │   mini       │        │  │
│  │  │ Output:      │      │ Input/Output:│      │              │        │  │
│  │  │ 384-dim      │      │ Float32Array │      │ Output:      │        │  │
│  │  │ vectors      │      │ vectors      │      │ Streaming    │        │  │
│  │  │              │      │              │      │ text         │        │  │
│  │  │ Memory:      │      │ Memory:      │      │ Memory:      │        │  │
│  │  │ ~150MB       │      │ ~100MB       │      │ ~2GB         │        │  │
│  │  │              │      │              │      │              │        │  │
│  │  │ Idle: 60s    │      │ Idle: 60s    │      │ Idle: 60s    │        │  │
│  │  │ auto-kill    │      │ auto-kill    │      │ auto-kill    │        │  │
│  │  │              │      │              │      │              │        │  │
│  │  └──────────────┘      └──────────────┘      └──────────────┘        │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         Persistent Storage Layer                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    IndexedDB (ElearningDB)                           │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                      │    │
│  │  - Notes (content + embeddings)          - Video bookmarks          │    │
│  │  - Courses (metadata)                    - Screenshots              │    │
│  │  - Study sessions                        - Challenges               │    │
│  │  - Content progress                      - Vector index cache       │    │
│  │  - Imported videos/PDFs                  - Model cache               │    │
│  │                                                                      │    │
│  │  Access Pattern:                                                    │    │
│  │  - Main thread: Read/Write (via Dexie)                             │    │
│  │  - Workers: Read-only (via Dexie)                                  │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          External Services (Fallback)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│  │  Anthropic API  │     │   OpenAI API    │     │ Ollama localhost│      │
│  │  (claude-3.5)   │     │   (gpt-4)       │     │  (if running)   │      │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘      │
│                                                                               │
│  Used when:                                                                  │
│  - WebGPU not supported (old browsers)                                       │
│  - Memory pressure (exceeds 3GB ceiling)                                     │
│  - User preference (privacy vs performance)                                  │
│  - Worker crashes repeatedly                                                 │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Note Creation with AI Indexing

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. Types note content
     ▼
┌─────────────────┐
│  NoteEditor     │
│  (React)        │
└────┬────────────┘
     │
     │ 2. Click "Save"
     ▼
┌─────────────────────────┐
│  useNoteStore           │
│  (Zustand)              │
│  saveNote(note)         │
└────┬────────────────────┘
     │
     │ 3. Optimistic update (immediate UI)
     ├─────────────────────────────────────────┐
     │                                         │
     │ 4. Save to IndexedDB (fast)             │
     ▼                                         │
┌──────────────┐                               │
│  Dexie       │                               │
│  db.notes    │                               │
│  .add()      │                               │
└──────────────┘                               │
     │                                         │
     │ 5. Generate embedding (background)      │
     ▼                                         │
┌───────────────────────┐                      │
│  Coordinator          │                      │
│  generateEmbeddings() │                      │
└────┬──────────────────┘                      │
     │                                         │
     │ 6. Route to worker                      │
     ▼                                         │
┌─────────────────────┐                        │
│  Embedding Worker   │                        │
│  (Transformers.js)  │                        │
└────┬────────────────┘                        │
     │                                         │
     │ 7. Model inference (~50ms)              │
     │ Text → 384-dim vector                   │
     ▼                                         │
┌──────────────────┐                           │
│  Float32Array    │                           │
│  [0.12, -0.45,   │                           │
│   ..., 0.87]     │                           │
└────┬─────────────┘                           │
     │                                         │
     │ 8. Return to main thread                │
     ▼                                         │
┌───────────────────────┐                      │
│  Coordinator          │                      │
│  resolve(embedding)   │                      │
└────┬──────────────────┘                      │
     │                                         │
     │ 9. Update IndexedDB                     │
     ▼                                         │
┌──────────────┐                               │
│  Dexie       │                               │
│  db.notes    │                               │
│  .update()   │                               │
└──────────────┘                               │
     │                                         │
     │ 10. Notify search worker                │
     ▼                                         │
┌─────────────────────┐                        │
│  CustomEvent        │                        │
│  "note-indexed"     │                        │
└─────────────────────┘                        │
                                               │
                                               │ 11. UI shows success
                                               ▼
                                          ┌─────────────────┐
                                          │  Toast          │
                                          │  "Note saved    │
                                          │   and indexed"  │
                                          └─────────────────┘

Total time: ~50-200ms (depending on model cache)
User perception: Instant (optimistic update at step 3)
```

---

## Data Flow: Semantic Search

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ 1. Types search query
     ▼
┌─────────────────┐
│  SearchBar      │
│  (React)        │
└────┬────────────┘
     │
     │ 2. Debounce 300ms
     ▼
┌─────────────────────────┐
│  handleSearch()         │
└────┬────────────────────┘
     │
     │ 3. Generate query embedding
     ▼
┌───────────────────────┐
│  Coordinator          │
│  generateEmbeddings() │
└────┬──────────────────┘
     │
     ▼
┌─────────────────────┐
│  Embedding Worker   │
│  (~50ms)            │
└────┬────────────────┘
     │
     │ 4. Query vector
     ▼
┌───────────────────────┐
│  Float32Array         │
│  [0.23, -0.12, ...]   │
└────┬──────────────────┘
     │
     │ 5. Search vector index
     ▼
┌───────────────────────┐
│  Coordinator          │
│  searchSimilarNotes() │
└────┬──────────────────┘
     │
     ▼
┌─────────────────────┐
│  Search Worker      │
│  (HNSW)             │
│  (~20ms)            │
└────┬────────────────┘
     │
     │ 6. Similar note IDs + scores
     ▼
┌──────────────────────┐
│  [{noteId, score}]   │
│  [{note-1, 0.92},    │
│   {note-2, 0.87},    │
│   {note-3, 0.81}]    │
└────┬─────────────────┘
     │
     │ 7. Fetch full notes
     ▼
┌──────────────┐
│  Dexie       │
│  db.notes    │
│  .bulkGet()  │
└────┬─────────┘
     │
     │ 8. Render results
     ▼
┌─────────────────┐
│  NoteList       │
│  (React)        │
└─────────────────┘
     │
     │ 9. Display to user
     ▼
┌─────────────────┐
│  User sees      │
│  3 relevant     │
│  notes          │
└─────────────────┘

Total time: ~370ms (300ms debounce + 50ms embed + 20ms search)
Perceived latency: ~70ms (after debounce)
```

---

## Memory Budget Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Budget (3GB Total)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Main Thread (750MB)                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  - React UI (200MB)                                        │ │
│  │  - Zustand stores (50MB)                                   │ │
│  │  - Dexie cache (100MB)                                     │ │
│  │  - Video player (200MB)                                    │ │
│  │  - PDF viewer (100MB)                                      │ │
│  │  - Other libraries (100MB)                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Embedding Worker (150MB)                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  - Transformers.js WASM runtime (50MB)                     │ │
│  │  - all-MiniLM-L6-v2 model (23MB)                           │ │
│  │  - Working buffers (77MB)                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Search Worker (100MB)                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  - HNSW graph (15MB for 10k vectors)                       │ │
│  │  - Vector cache (30MB)                                     │ │
│  │  - Working buffers (55MB)                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Inference Worker (2GB)                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  - WebLLM runtime (200MB)                                  │ │
│  │  - Llama 3.2 1B model (664MB)                              │ │
│  │  - WebGPU buffers (1GB)                                    │ │
│  │  - Tokenizer & KV cache (136MB)                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Total: 3GB                                                      │
│                                                                  │
│  ⚠️  If total > 3GB:                                             │
│  - Terminate inference worker (-2GB)                             │
│  - Fall back to cloud API                                        │
│  - Show user notification                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Worker Lifecycle States

```
┌─────────────────────────────────────────────────────────────────┐
│                    Worker State Machine                          │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │ Not Spawned │  (Initial state)
                    └──────┬──────┘
                           │
              First task   │
              arrives      │
                           ▼
                    ┌─────────────┐
                    │  Spawning   │  (new Worker() called)
                    └──────┬──────┘
                           │
              Worker       │   ┌──────► [Error] (spawn failed)
              initialized  │   │
                           ▼   │
                    ┌─────────────┐
                    │Initializing │  (Loading model)
                    └──────┬──────┘
                           │
              Model loaded │   ┌──────► [Error] (model load failed)
                           │   │
                           ▼   │
                    ┌─────────────┐
              ┌────►│    Ready    │  (Idle, waiting for tasks)
              │     └──────┬──────┘
              │            │
              │  Task      │
              │  request   │
              │            ▼
              │     ┌─────────────┐
              │     │   Active    │  (Processing task)
              │     └──────┬──────┘
              │            │
              │  Task      │
              │  complete  │
              │            │
              │            ▼
              │     ┌─────────────┐
              └─────┤    Idle     │  (No active requests)
                    └──────┬──────┘
                           │
              60s timeout  │   ┌──────► [Active] (new task)
              expires      │   │
                           ▼   │
                    ┌─────────────┐
                    │ Terminated  │  (Memory reclaimed)
                    └─────────────┘

Special transitions:
- Any state → [Error]: Worker crashes, OOM, or unhandled error
- [Error] → [Not Spawned]: Coordinator removes from pool
- [Terminated] → [Spawning]: New task arrives (lazy respawn)
```

---

## Component Integration Map

```
┌─────────────────────────────────────────────────────────────────┐
│           React Components → Worker Integration                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  UI Layer                 Zustand Store         Worker API       │
│                                                                  │
│  NoteEditor ──────────►  useNoteStore ───────► generateEmbeddings│
│  │                       .saveNote()                             │
│  │                                                                │
│  └─► TipTap Editor                                               │
│                                                                  │
│  NotesPage ────────────► useNoteStore ───────► searchSimilarNotes│
│  │                       .loadNotes()                            │
│  │                                                                │
│  └─► SearchBar                                                   │
│                                                                  │
│  VideoPlayer ──────────► useSessionStore ────► (no workers yet)  │
│  │                       .startSession()                         │
│  │                                                                │
│  └─► VideoSummary ───────────────────────────► streamInfer      │
│                                                 (Epic 9B)        │
│                                                                  │
│  CourseImport ─────────► useCourseImportStore ► generateEmbeddings│
│  │                       .importCourse()       (batch)           │
│  │                                                                │
│  └─► ProgressBar                                                 │
│                                                                  │
│  Settings ─────────────► useAIStore ──────────► coordinator      │
│  │                       .setProvider()        .terminate()      │
│  │                                             .getStatus()      │
│  └─► AIProviderToggle                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fallback Strategy (3-Tier)

```
┌─────────────────────────────────────────────────────────────────┐
│                   AI Provider Fallback Strategy                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Tier 1: WebGPU Local (Best UX)                                  │
├─────────────────────────────────────────────────────────────────┤
│  Provider: WebLLM (in Inference Worker)                          │
│  Latency: ~15s for 500 tokens                                    │
│  Cost: $0 (free)                                                 │
│  Privacy: ✅ Fully local (no data sent externally)               │
│  Memory: 2GB                                                     │
│  Requirements: WebGPU, 3GB RAM                                   │
│                                                                  │
│  Fallback to Tier 2 if:                                          │
│  - WebGPU not supported (old browsers)                           │
│  - Memory pressure (exceeds 3GB)                                 │
│  - Worker crashes repeatedly (>3 times/hour)                     │
└─────────────────────────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 2: Ollama Localhost (Good UX)                              │
├─────────────────────────────────────────────────────────────────┤
│  Provider: Ollama (http://localhost:11434)                       │
│  Latency: ~10s for 500 tokens                                    │
│  Cost: $0 (free, uses local GPU/CPU)                             │
│  Privacy: ✅ Local (requires Ollama installed)                   │
│  Memory: 0MB browser (runs in separate process)                  │
│  Requirements: Ollama server running                             │
│                                                                  │
│  Fallback to Tier 3 if:                                          │
│  - Ollama not installed                                          │
│  - Ollama server not running                                     │
│  - Network timeout (localhost unreachable)                       │
└─────────────────────────────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tier 3: Cloud API (Fallback)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Providers: Anthropic Claude / OpenAI GPT-4                      │
│  Latency: ~2s for 500 tokens                                     │
│  Cost: ~$0.03 per request (user pays)                            │
│  Privacy: ⚠️  Data sent to external API                          │
│  Memory: 0MB browser                                             │
│  Requirements: API key, internet connection                      │
│                                                                  │
│  User must:                                                      │
│  - Provide API key in settings                                   │
│  - Consent to data sharing                                       │
│  - Accept cost implications                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Model                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  User Content (Sensitive)                                  │ │
│  │  - Notes                                                   │ │
│  │  - Video transcripts                                       │ │
│  │  - PDF highlights                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                      │
│           │ Encrypted at rest (IndexedDB encryption)            │
│           ▼                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  IndexedDB (Browser Storage)                               │ │
│  │  ✅ Same-origin policy (isolated from other sites)         │ │
│  │  ✅ Encrypted if device has full-disk encryption           │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                      │
│           │ Read-only access                                    │
│           ▼                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Workers (Isolated Contexts)                               │ │
│  │  ✅ No DOM access                                          │ │
│  │  ✅ No access to main thread globals                       │ │
│  │  ✅ postMessage only communication                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                      │
│           │ Local processing (no network)                       │
│           ▼                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  AI Models (Local Inference)                               │ │
│  │  ✅ Runs entirely in browser (WebGPU/WASM)                 │ │
│  │  ✅ No data sent to external servers                       │ │
│  │  ✅ Models cached in IndexedDB (same-origin)               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ⚠️  Exception: Cloud API Fallback (Tier 3)                     │
│  - User must explicitly consent                                 │
│  - API key stored in localStorage (plaintext)                   │
│  - Data sent to Anthropic/OpenAI (see privacy policy)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document Status:** ✅ Complete
**Last Updated:** 2026-03-10
**Purpose:** Visual reference for system architecture and data flows

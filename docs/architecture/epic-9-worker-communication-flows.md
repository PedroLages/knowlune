# Epic 9 Worker Communication Flows

**Companion to:** epic-9-web-worker-design.md
**Date:** 2026-03-10

---

## Overview

This document provides detailed sequence diagrams for all worker communication patterns in Epic 9.

---

## Flow 1: Embedding Generation (Single Note)

**Scenario:** User saves a note, system generates embedding in background

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  User   │         │ NoteEditor   │         │ Coordinator  │         │EmbedWorker   │
└────┬────┘         └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
     │                     │                        │                        │
     │ Click "Save"        │                        │                        │
     ├────────────────────►│                        │                        │
     │                     │                        │                        │
     │                     │ saveNote(content)      │                        │
     │                     ├───────────────────────►│                        │
     │                     │                        │                        │
     │                     │◄───────────────────────┤                        │
     │                     │ Promise pending        │                        │
     │                     │                        │                        │
     │ Show saving toast   │                        │ getOrCreateWorker()    │
     │◄────────────────────┤                        ├───────────────────────►│
     │                     │                        │                        │
     │                     │                        │ postMessage({          │
     │                     │                        │   requestId: "uuid-1"  │
     │                     │                        │   type: "embed"        │
     │                     │                        │   payload: { texts }   │
     │                     │                        │ })                     │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │                     │                        │                        │ Load model
     │                     │                        │                        │ (if first time)
     │                     │                        │                        │ ⏱ ~150ms
     │                     │                        │                        │
     │                     │                        │                        │ Generate
     │                     │                        │                        │ embedding
     │                     │                        │                        │ ⏱ ~50ms
     │                     │                        │                        │
     │                     │                        │ postMessage({          │
     │                     │                        │   requestId: "uuid-1"  │
     │                     │                        │   type: "success"      │
     │                     │                        │   result: {embeddings} │
     │                     │                        │ })                     │
     │                     │                        │◄───────────────────────┤
     │                     │                        │                        │
     │                     │ resolve(embeddings)    │                        │
     │                     │◄───────────────────────┤                        │
     │                     │                        │                        │
     │                     │ Update Zustand         │                        │
     │                     │ (add embedding)        │                        │
     │                     │                        │                        │
     │ Show success toast  │                        │                        │
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │
     │                     │                        │ scheduleIdleTermination│
     │                     │                        │ (60s timer)            │
     │                     │                        │                        │
     │                     │                        │                        │

Total time: ~200ms (first time) or ~50ms (cached model)
```

---

## Flow 2: Batch Embedding Generation

**Scenario:** User imports 100 notes, system batches embeddings for efficiency

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  User   │         │ ImportPage   │         │ Coordinator  │         │EmbedWorker   │
└────┬────┘         └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
     │                     │                        │                        │
     │ Import 100 notes    │                        │                        │
     ├────────────────────►│                        │                        │
     │                     │                        │                        │
     │                     │ Loop: Batch notes      │                        │
     │                     │ in groups of 20        │                        │
     │                     │                        │                        │
     │                     │ generateEmbeddings(    │                        │
     │                     │   texts[0..19]         │                        │
     │                     │ )                      │                        │
     │                     ├───────────────────────►│                        │
     │                     │                        │                        │
     │                     │                        │ postMessage({          │
     │                     │                        │   texts: [20 items]    │
     │                     │                        │ })                     │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │ Show progress:      │                        │                        │ Process batch
     │ "20/100 indexed"    │                        │                        │ ⏱ ~1000ms
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │
     │                     │                        │ resolve(embeddings)    │
     │                     │◄───────────────────────┤◄───────────────────────┤
     │                     │                        │                        │
     │                     │ Save batch to Dexie    │                        │
     │                     │                        │                        │
     │                     │ generateEmbeddings(    │                        │
     │                     │   texts[20..39]        │                        │
     │                     │ )                      │                        │
     │                     ├───────────────────────►│                        │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │ Show progress:      │                        │                        │ Process batch
     │ "40/100 indexed"    │                        │                        │ ⏱ ~1000ms
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │
     │                     │◄───────────────────────┤◄───────────────────────┤
     │                     │                        │                        │
     │                     │ ... (repeat 3 more times)                      │
     │                     │                        │                        │
     │ Show complete:      │                        │                        │
     │ "100/100 indexed"   │                        │                        │
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │

Total time: ~5000ms (5 batches × 1000ms)
Batching reduces overhead: 100 messages → 5 messages
```

---

## Flow 3: Semantic Search with Vector Index

**Scenario:** User searches notes, system uses vector similarity

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User   │    │ NotesPage    │    │ Coordinator  │    │EmbedWorker   │    │SearchWorker  │
└────┬────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
     │                │                   │                   │                   │
     │ Type: "ML"     │                   │                   │                   │
     ├───────────────►│                   │                   │                   │
     │                │                   │                   │                   │
     │                │ Debounce 300ms    │                   │                   │
     │                │ ...               │                   │                   │
     │                │                   │                   │                   │
     │ Type: "ML basics"                  │                   │                   │
     ├───────────────►│                   │                   │                   │
     │                │                   │                   │                   │
     │                │ Debounce 300ms    │                   │                   │
     │                │ ...               │                   │                   │
     │                │                   │                   │                   │
     │ User stops typing                  │                   │                   │
     │                │                   │                   │                   │
     │                │ handleSearch(     │                   │                   │
     │                │   "ML basics"     │                   │                   │
     │                │ )                 │                   │                   │
     │                │                   │                   │                   │
     │                │ Step 1: Generate query embedding      │                   │
     │                │ generateEmbeddings(["ML basics"])     │                   │
     │                ├──────────────────►│                   │                   │
     │                │                   ├──────────────────►│                   │
     │                │                   │                   │ Embed query       │
     │                │                   │                   │ ⏱ ~50ms           │
     │                │                   │                   │                   │
     │                │ queryVector       │                   │                   │
     │                │◄──────────────────┤◄──────────────────┤                   │
     │                │                   │                   │                   │
     │                │ Step 2: Search vector index           │                   │
     │                │ searchSimilarNotes(queryVector, 10)   │                   │
     │                ├──────────────────►│                   │                   │
     │                │                   ├──────────────────────────────────────►│
     │                │                   │                   │                   │
     │                │                   │                   │                   │ HNSW search
     │                │                   │                   │                   │ ⏱ ~20ms
     │                │                   │                   │                   │
     │                │ results: [        │                   │                   │
     │                │   {noteId, score} │                   │                   │
     │                │ ]                 │                   │                   │
     │                │◄──────────────────┤◄──────────────────────────────────────┤
     │                │                   │                   │                   │
     │                │ Step 3: Fetch notes from Dexie        │                   │
     │                │ db.notes.bulkGet(noteIds)             │                   │
     │                │                   │                   │                   │
     │                │ setSearchResults(notes)               │                   │
     │                │                   │                   │                   │
     │ Display results│                   │                   │                   │
     │◄───────────────┤                   │                   │                   │
     │                │                   │                   │                   │

Total search time: ~370ms (300ms debounce + 50ms embed + 20ms search)
Perceived latency: ~70ms (after debounce)
```

---

## Flow 4: Worker Crash & Recovery

**Scenario:** Embedding worker crashes due to OOM, system recovers gracefully

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  User   │         │ NoteEditor   │         │ Coordinator  │         │EmbedWorker   │
└────┬────┘         └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
     │                     │                        │                        │
     │ Save note           │                        │                        │
     ├────────────────────►│                        │                        │
     │                     │                        │                        │
     │                     │ saveNote()             │                        │
     │                     ├───────────────────────►│                        │
     │                     │                        │                        │
     │                     │                        │ postMessage()          │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │                     │                        │                        │ Processing...
     │                     │                        │                        │
     │                     │                        │                        │ ❌ OOM Error
     │                     │                        │                        │ Worker crashes
     │                     │                        │                        │
     │                     │                        │ onerror event          │
     │                     │                        │◄───────────────────────┤
     │                     │                        │                        │
     │                     │                        │ handleWorkerError()    │
     │                     │                        │                        │
     │                     │                        │ 1. Terminate worker    │
     │                     │                        │ 2. Remove from pool    │
     │                     │                        │ 3. Reject pending      │
     │                     │                        │    requests            │
     │                     │                        │                        │
     │                     │ reject(Error)          │                        │
     │                     │◄───────────────────────┤                        │
     │                     │                        │                        │
     │                     │ Show error toast:      │                        │
     │                     │ "AI indexing failed"   │                        │
     │                     │                        │                        │
     │ See error message   │                        │ Dispatch custom event: │
     │◄────────────────────┤                        │ 'worker-crash'         │
     │                     │◄───────────────────────┤                        │
     │                     │                        │                        │
     │ User retries        │                        │                        │
     ├────────────────────►│                        │                        │
     │                     │                        │                        │
     │                     │ saveNote() retry       │                        │
     │                     ├───────────────────────►│                        │
     │                     │                        │                        │
     │                     │                        │ getOrCreateWorker()    │
     │                     │                        │ (spawns new worker)    │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │ New worker
     │                     │                        │                        │ initialized
     │                     │                        │                        │
     │                     │                        │ postMessage()          │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │                     │                        │                        │ Success
     │                     │                        │◄───────────────────────┤
     │                     │                        │                        │
     │                     │ resolve(embeddings)    │                        │
     │                     │◄───────────────────────┤                        │
     │                     │                        │                        │
     │ Success toast       │                        │                        │
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │

Recovery time: ~150ms (worker respawn)
User impact: Error toast + manual retry (acceptable for rare OOM events)
```

---

## Flow 5: Streaming LLM Inference (Video Summary)

**Scenario:** User requests video summary, LLM streams response incrementally

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User   │    │ VideoPlayer  │    │ Coordinator  │    │InferWorker   │
└────┬────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
     │               │                   │                   │
     │ Click "Summarize"                 │                   │
     ├──────────────►│                   │                   │
     │               │                   │                   │
     │               │ generateSummary(  │                   │
     │               │   transcript      │                   │
     │               │ )                 │                   │
     │               ├──────────────────►│                   │
     │               │                   │                   │
     │               │                   │ getOrCreateWorker()│
     │               │                   ├──────────────────►│
     │               │                   │                   │
     │               │                   │                   │ Load model
     │ Show loading  │                   │                   │ (if needed)
     │ skeleton      │                   │                   │ ⏱ ~5000ms
     │◄──────────────┤                   │                   │
     │               │                   │                   │
     │               │                   │ postMessage({     │
     │               │                   │   type: "infer",  │
     │               │                   │   stream: true    │
     │               │                   │ })                │
     │               │                   ├──────────────────►│
     │               │                   │                   │
     │               │                   │                   │ Start inference
     │               │                   │                   │
     │               │                   │ {type:"stream-    │
     │               │                   │  chunk",          │
     │               │                   │  chunk:"This"}    │
     │               │                   │◄──────────────────┤
     │               │                   │                   │
     │               │ onChunk("This")   │                   │
     │               │◄──────────────────┤                   │
     │               │                   │                   │
     │ Display: "This"                   │                   │
     │◄──────────────┤                   │                   │
     │               │                   │                   │
     │               │                   │ {chunk:" video"}  │
     │               │                   │◄──────────────────┤
     │               │◄──────────────────┤                   │
     │               │                   │                   │
     │ Update: "This video"              │                   │
     │◄──────────────┤                   │                   │
     │               │                   │                   │
     │               │                   │ {chunk:" covers"} │
     │               │                   │◄──────────────────┤
     │               │◄──────────────────┤                   │
     │               │                   │                   │
     │ Update: "This video covers"       │                   │
     │◄──────────────┤                   │                   │
     │               │                   │                   │
     │               │  ... (50 more chunks) ...             │
     │               │                   │                   │
     │               │                   │ {type:"stream-    │
     │               │                   │  end"}            │
     │               │                   │◄──────────────────┤
     │               │                   │                   │
     │               │ resolve()         │                   │
     │               │◄──────────────────┤                   │
     │               │                   │                   │
     │ Final text    │                   │                   │
     │◄──────────────┤                   │                   │
     │               │                   │                   │

Total time: ~15s (5s model load + 10s inference at 30 tokens/s)
Streaming UX: Text appears incrementally (no "loading..." freeze)
```

---

## Flow 6: Idle Worker Termination (Memory Reclaim)

**Scenario:** User stops taking notes, embedding worker auto-terminates after 60s

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ NoteEditor   │         │ Coordinator  │         │EmbedWorker   │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ saveNote()             │                        │
       ├───────────────────────►│                        │
       │                        │ postMessage()          │
       │                        ├───────────────────────►│
       │                        │                        │ Process
       │                        │◄───────────────────────┤
       │◄───────────────────────┤                        │
       │                        │                        │
       │                        │ scheduleIdleTermination│
       │                        │ (60s timer)            │
       │                        │                        │
       │                        │                        │
       │ ... 60 seconds of no activity ...               │
       │                        │                        │
       │                        │ Idle timeout fires     │
       │                        │                        │
       │                        │ Check conditions:      │
       │                        │ - activeRequests === 0 │
       │                        │ - lastUsed > 60s ago   │
       │                        │                        │
       │                        │ worker.terminate()     │
       │                        ├───────────────────────►│
       │                        │                        │ ❌ Terminated
       │                        │                        │
       │                        │ pool.delete("embed")   │
       │                        │                        │
       │                        │ console.log:           │
       │                        │ "Terminated idle       │
       │                        │  worker: embed-worker" │
       │                        │                        │
       │ ... 5 minutes later ...                         │
       │                        │                        │
       │ User creates note      │                        │
       ├───────────────────────►│                        │
       │                        │                        │
       │                        │ getOrCreateWorker()    │
       │                        │ (worker not in pool)   │
       │                        │                        │
       │                        │ spawnWorker("embed")   │
       │                        ├───────────────────────►│
       │                        │                        │ New worker
       │                        │                        │ spawned
       │                        │                        │ ⏱ ~150ms
       │                        │                        │
       │                        │◄───────────────────────┤
       │◄───────────────────────┤                        │
       │                        │                        │

Memory saved during idle period: ~150MB
Respawn cost: ~150ms (acceptable for infrequent use)
```

---

## Flow 7: Parallel Worker Execution

**Scenario:** User generates embedding while searching simultaneously

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  User   │    │ UI (Split)   │    │ Coordinator  │    │EmbedWorker   │    │SearchWorker  │
└────┬────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
     │                │                   │                   │                   │
     │ Panel 1:       │                   │                   │                   │
     │ Create note    │                   │                   │                   │
     ├───────────────►│                   │                   │                   │
     │                │                   │                   │                   │
     │                │ generateEmbeddings│                   │                   │
     │                ├──────────────────►│                   │                   │
     │                │                   ├──────────────────►│                   │
     │                │                   │                   │ Start embed       │
     │ Panel 2:       │                   │                   │ ⏱ 50ms            │
     │ Search notes   │                   │                   │                   │
     ├───────────────►│                   │                   │                   │
     │                │                   │                   │                   │
     │                │ searchSimilarNotes│                   │                   │
     │                ├──────────────────►│                   │                   │
     │                │                   ├──────────────────────────────────────►│
     │                │                   │                   │                   │
     │                │                   │                   │                   │ Start search
     │                │                   │                   │                   │ ⏱ 20ms
     │                │                   │                   │                   │
     │                │                   │                   │ Embed complete    │
     │                │ resolve(embedding)│◄──────────────────┤                   │
     │                │◄──────────────────┤                   │                   │
     │                │                   │                   │                   │
     │ Panel 1: Done  │                   │                   │                   │
     │◄───────────────┤                   │                   │                   │
     │                │                   │                   │                   │ Search complete
     │                │ resolve(results)  │                   │◄──────────────────┤
     │                │◄──────────────────┤───────────────────────────────────────┤
     │                │                   │                   │                   │
     │ Panel 2: Done  │                   │                   │                   │
     │◄───────────────┤                   │                   │                   │
     │                │                   │                   │                   │

Parallel execution: Both workers run simultaneously
Total time: max(50ms, 20ms) = 50ms (not 70ms sequential)
Benefit: 28% faster than sequential execution
```

---

## Flow 8: Model Download with Progress

**Scenario:** First-time LLM user, model downloads with progress indicator

```
┌─────────┐         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  User   │         │ VideoPlayer  │         │ Coordinator  │         │InferWorker   │
└────┬────┘         └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
     │                     │                        │                        │
     │ Click "Summarize"   │                        │                        │
     ├────────────────────►│                        │                        │
     │                     │                        │                        │
     │                     │ generateSummary()      │                        │
     │                     ├───────────────────────►│                        │
     │                     │                        │                        │
     │                     │                        │ getOrCreateWorker()    │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │ Show modal:         │                        │                        │ Initialize
     │ "Downloading AI"    │                        │                        │ WebLLM
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │ Fetch model
     │                     │                        │                        │ from HF
     │                     │                        │                        │
     │                     │                        │ {type:"download-       │
     │                     │                        │  progress",            │
     │                     │                        │  progress: 5}          │
     │                     │                        │◄───────────────────────┤
     │                     │                        │                        │
     │ Update modal:       │                        │                        │
     │ "5% (33MB/664MB)"   │◄───────────────────────┤                        │
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │
     │                     │                        │ {progress: 15}         │
     │                     │                        │◄───────────────────────┤
     │ Update: "15%"       │◄───────────────────────┤                        │
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │
     │                     │  ... (repeated 20 times) ...                    │
     │                     │                        │                        │
     │                     │                        │ {progress: 100}        │
     │                     │                        │◄───────────────────────┤
     │                     │◄───────────────────────┤                        │
     │                     │                        │                        │
     │ Close modal         │                        │                        │ Model ready
     │◄────────────────────┤                        │                        │
     │                     │                        │                        │
     │                     │                        │ postMessage({          │
     │                     │                        │   type: "infer"        │
     │                     │                        │ })                     │
     │                     │                        ├───────────────────────►│
     │                     │                        │                        │
     │                     │                        │                        │ Inference
     │                     │                        │                        │ starts
     │                     │                        │                        │
     │ Stream chunks...    │                        │                        │
     │◄────────────────────┤◄───────────────────────┤◄───────────────────────┤
     │                     │                        │                        │

Download time: ~60s (664MB model at ~10MB/s)
Cached for next use (stored in IndexedDB)
Progress updates every 5% (smooth UX)
```

---

## Summary Table

| Flow | Workers Involved | Latency | Memory Impact | User Impact |
|------|------------------|---------|---------------|-------------|
| **Single Embedding** | Embed | 50ms | +150MB | None (background) |
| **Batch Embedding** | Embed | 5000ms | +150MB | Progress bar |
| **Semantic Search** | Embed + Search | 70ms | +250MB | Instant results |
| **Worker Crash** | Any | 150ms | -150MB → +150MB | Error toast, manual retry |
| **Streaming LLM** | Infer | 15s | +2GB | Incremental text |
| **Idle Termination** | Any | 60s delay | -150MB to -2GB | None |
| **Parallel Execution** | Multiple | 50ms (max) | +250MB | Faster UX |
| **Model Download** | Infer | 60s (one-time) | +2GB | Progress modal |

---

**Next Steps:**
1. Implement flows in order (1 → 8)
2. Add telemetry to track actual latencies
3. Optimize batch sizes based on production data
4. Monitor crash rates and adjust memory limits

**Document Status:** ✅ Ready for Implementation
**Last Updated:** 2026-03-10

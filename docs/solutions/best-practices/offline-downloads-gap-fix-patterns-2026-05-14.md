---
title: "Offline Book Downloads -- IndexedDB Fallback, TransformStream Progress, and Iterative Retry Patterns"
date: 2026-05-14
category: best-practices
module: downloads
problem_type: best_practice
component: development_workflow
severity: medium
applies_when:
  - Adding an IndexedDB fallback for a service that primarily uses OPFS (Origin Private File System) for storage
  - Reporting real-time progress during a streaming pipe operation (response.body.pipeTo)
  - Deciding between recursive and iterative loop structures for retry and queue-drain logic
  - Storing chunked file data in IndexedDB when OPFS is unavailable
tags:
  - indexeddb
  - opfs
  - fallback
  - transform-stream
  - progress
  - streaming
  - retry
  - iterative
  - recursion
  - for-loop
  - while-loop
  - chunked-storage
  - offline-downloads
  - bookmark-files
  - implementation-lessons
related_components:
  - offline-downloads
  - gap-fixes
---

# Offline Book Downloads -- IndexedDB Fallback, TransformStream Progress, and Iterative Retry Patterns

## Context

PR [#569](https://github.com/PedroLages/knowlune/pull/569) shipped the offline book downloads feature. A post-ship plan review identified three P0-P2 gaps that were then fixed in a follow-up commit (`272b77ec`). These gaps and their fixes produced three reusable patterns:

1. **IndexedDB OPFS fallback (P0)** -- The initial `DownloadManager` wrote directly to OPFS file handles instead of going through `OpfsStorageService`, which already had an IndexedDB fallback. The fix added a new `storeStreamToBookFile()` method with built-in IDB fallback that writes chunks as individual records to avoid in-memory buffering.

2. **TransformStream progress interception (P2)** -- The initial implementation piped `response.body` directly to the OPFS writable via `pipeTo()`, which prevented any progress reporting during the streaming write phase. The fix inserted a `TransformStream` between the fetch body and the OPFS writable, with a `pump` loop that counts bytes and emits throttled progress updates.

3. **Iterative retry refactor (P2)** -- Both `_performDownload` (retry) and `_drainQueue` used recursive calls without a depth guard. While theoretically bounded (max 3 retries, typical queue depth < 10), this violated project robustness conventions. The fix converted both to iterative loops: a `for` loop for retry and a `while` loop for queue drain.

The fix also added 23 unit tests and 7 E2E tests (P1 gap).

## Guidance

### 1. IndexedDB OPFS Fallback with Chunked Streaming Writes

**Problem.** The initial `DownloadManager._performDownload()` wrote directly to OPFS file handles (`getDirectoryHandle` -> `createWritable`), bypassing `OpfsStorageService.storeBookFile()` which had an existing IndexedDB fallback. If OPFS was unavailable (e.g., restrictive browser policies, private browsing modes, or older Safari versions), the download failed with an unhandled error. No fallback path existed.

**Solution: Add `storeStreamToBookFile()` to `OpfsStorageService` with transparent IDB fallback.**

```typescript
// OpfsStorageService.storeStreamToBookFile() -- handles both OPFS and IDB paths
async storeStreamToBookFile(
  bookId: string,
  filename: string,
  stream: ReadableStream<Uint8Array>,
  onProgress?: (bytesWritten: number) => void
): Promise<string> {
  await this.init()

  if (this._useIndexedDBFallback) {
    // IDB fallback path: write chunks as individual records
    const reader = stream.getReader()
    let totalBytes = 0
    let chunkIndex = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const paddedIdx = String(chunkIndex).padStart(6, '0')
      await db.bookFiles.put({
        bookId,
        filename: `${filename}.part.${paddedIdx}`,
        blob: new Blob([value]),
      })
      chunkIndex++
      totalBytes += value.byteLength
      onProgress?.(totalBytes)
    }

    // Metadata record tracks total chunks for reassembly on read
    await db.bookFiles.put({
      bookId,
      filename: `${filename}.meta`,
      blob: new Blob([JSON.stringify({ totalChunks: chunkIndex })]),
    })

    return 'indexeddb'
  }

  // OPFS path: stream directly to file handle
  const opfsPath = `/${OPFS_ROOT}/${BOOKS_DIR}/${bookId}/${filename}`
  const bookDir = await this.getBookDir(bookId)
  const fileHandle = await bookDir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()

  if (onProgress) {
    // TransformStream inserted for progress (see Lesson 2)
    const transform = new TransformStream()
    const transformWriter = transform.writable.getWriter()
    const reader = stream.getReader()
    let bytesWritten = 0

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytesWritten += value.byteLength
        await transformWriter.write(value)
        onProgress(bytesWritten)
      }
      await transformWriter.close()
    }

    await Promise.all([pump(), transform.readable.pipeTo(writable)])
  } else {
    await stream.pipeTo(writable)
  }

  return opfsPath
}
```

**Key design decisions for the IDB fallback:**

- **Chunked storage (not a single blob record):** Streaming the readable pushes individual chunks to IndexedDB as separate `book.epub.part.NNNNNN` records. This avoids buffering the entire file in memory, which is critical for audiobooks that can exceed 500MB. IndexedDB has per-record size limits (typically 2MB-8MB depending on the browser), so storing each chunk as its own record is safer than attempting to write the full file as a single Blob.

- **Metadata record for reassembly:** A `book.epub.meta` record stores the total chunk count. On read, the service queries all records for the bookId, separates metadata from chunk records, and reassembles chunks in order using a `Map<filename, Blob>` for O(1) chunk lookup. The chunk index is zero-padded to 6 digits (`000000`, `000001`, ...) so lexicographic sort order matches file order.

- **Return value semantics:** Returns the literal string `'indexeddb'` in fallback mode (instead of a path), signaling to callers that storage is IDB-backed. The `readBookFile()` method dispatches on this — if the stored path equals `'indexeddb'`, it reads from Dexie instead of OPFS.

- **Transparent to callers:** `DownloadManager._performDownload()` calls `opfsStorageService.storeStreamToBookFile()` without knowing whether the storage backend is OPFS or IDB. The abstraction is leaky only in the return value (`'indexeddb'` vs an OPFS path), which is consumed by `readBookFile()` and `offlinePath` storage — both internal details.

**Read-path chunk reassembly:**

```typescript
// Inside readBookFile() -- IDB fallback read path
const metaRecord = records.find(r => r.filename.endsWith('.meta'))
if (metaRecord) {
  const metaText = await metaRecord.blob.text()
  const meta = JSON.parse(metaText)
  const totalChunks: number = meta.totalChunks ?? 0

  const chunkMap = new Map<string, Blob>()
  for (const r of records) {
    if (r.filename.endsWith('.meta')) continue
    chunkMap.set(r.filename, r.blob)
  }

  const originalFilename = metaRecord.filename.replace(/\.meta$/, '')
  const blobs: Blob[] = []
  for (let i = 0; i < totalChunks; i++) {
    const paddedIdx = String(i).padStart(6, '0')
    const blob = chunkMap.get(`${originalFilename}.part.${paddedIdx}`)
    if (blob) blobs.push(blob)
  }
  if (blobs.length === 0) return null
  return new File(blobs as BlobPart[], originalFilename)
}
```

**When to use this pattern:**
- Any service that primarily uses OPFS but needs a transparent fallback when OPFS is unavailable
- Any case where a `ReadableStream<Uint8Array>` needs to be persisted to IndexedDB without buffering in memory
- The chunked metadata pattern is generalizable for any streamable data that needs to be stored in IDB

### 2. TransformStream Progress Interception During Streaming Writes

**Problem.** The initial implementation piped `response.body` directly to the OPFS `WritableStream` via `pipeTo()`. This is a fire-and-forget pattern — the promise resolves only when the entire stream has been written. During the streaming phase (which can last minutes for large audiobooks), the progress ring appeared stuck at 0% with no way to report intermediate byte counts.

```typescript
// Before -- no progress tracking
await stream.pipeTo(writable)
// Promise resolves only when done -- no intermediate progress
```

**Solution: Insert a `TransformStream` between source and destination with a `pump` loop.**

```typescript
// After -- TransformStream intercepts bytes for progress
const transform = new TransformStream()
const transformWriter = transform.writable.getWriter()
const reader = stream.getReader()
let bytesWritten = 0
let lastProgressUpdate = 0

const pump = async () => {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesWritten += value.byteLength
    await transformWriter.write(value)

    // Throttled progress emission (every 250ms)
    const now = Date.now()
    if (now - lastProgressUpdate > 250) {
      lastProgressUpdate = now
      onProgress?.(bytesWritten)
    }
  }
  await transformWriter.close()
}

// Run pump and pipe concurrently -- pump feeds the transform writable
// while pipeTo drains the transform readable into the OPFS writable
await Promise.all([pump(), transform.readable.pipeTo(writable)])
```

**How it works:**

1. A `TransformStream` is created with zero transforming logic — it is used purely as a pass-through for intercepting byte flow.
2. A `pump` async function reads from the original `ReadableStream` chunk by chunk, counts bytes, calls the progress callback (throttled), and writes each chunk to the transform's writable side.
3. `transform.readable.pipeTo(writable)` drains the transform's readable side into the OPFS writable.
4. Both `pump()` and `pipeTo()` run concurrently via `Promise.all()`. The transform stream acts as a buffer: `pump()` produces chunks into the writable side, and `pipeTo()` consumes them from the readable side.
5. When `pump()` finishes reading the source stream, it closes the transform writer, which signals the end of the readable stream to `pipeTo()`.

**Why a TransformStream (not a custom WritableStream):**

- The `WritableStream` API for OPFS (`fileHandle.createWritable()`) is a native browser object — wrapping it would break the direct `pipeTo` contract.
- A `TransformStream` is the idiomatic way to insert an observation point in a stream pipeline. It separates the concerns: the transform does nothing to the data (pass-through), but provides a readable/writable pair that can be independently consumed and produced.
- The `pump` pattern (manually reading from one stream and writing to another) is more explicit about byte counting than a custom `TransformStream` with a `transform()` method, because the progress callback is called synchronously with `write()` rather than in a transform microtask.

**Throttling strategy:** Progress updates are throttled to once per 250ms (not per-chunk) to avoid flooding the Zustand store with high-frequency updates. For large audiobooks where chunks arrive faster than 250ms, this reduces store writes from thousands to dozens. The `lastProgressUpdate` check is a simple time-based gate:

```typescript
const now = Date.now()
if (now - lastProgressUpdate > 250) {
  lastProgressUpdate = now
  store.setDownloadState(bookId, { progress: bytesWritten, status: 'downloading' })
}
```

An alternative throttling strategy (every N bytes or N chunks) was considered but rejected because:
- Files of very different sizes (100KB EPUB vs 500MB audiobook) would have different chunk arrival rates
- Time-based throttling provides consistent store update frequency regardless of file size or network speed
- 250ms is fast enough to feel responsive but slow enough to avoid store overhead

**When to use this pattern:**
- Any `pipeTo()` operation where intermediate progress reporting is needed but the pipe destination is a native object you cannot wrap
- When you need to observe a stream without modifying its data
- The same pattern works for upload progress (`fetch` request body from a `ReadableStream` to a server) with the roles reversed

### 3. Iterative Retry Refactor (Recursive to For/While Loop)

**Problem.** The initial `_performDownload` method used recursion for retry:

```typescript
// Before -- recursive retry
private async _performDownload(book: Book): Promise<void> {
  try {
    // ... fetch and stream ...
  } catch (err) {
    if (attempt < maxRetries) {
      // ... wait ...
      await this._performDownload(book)  // RECURSIVE CALL
    } else {
      // mark as failed
    }
  }
}

// Before -- recursive queue drain
private async _drainQueue(): Promise<void> {
  const pending = getPending()
  if (!pending) return
  await this._performDownload(pending)
  await this._drainQueue()  // RECURSIVE CALL
}
```

The recursion was bounded (max 3 retries, typical queue depth < 10), but violated the project's robustness conventions — a theoretical stack overflow existed if retries and queue depth compounded, and the recursive pattern was harder to reason about for new contributors.

**Solution: `for` loop for bounded retry, `while` loop for queue drain.**

```typescript
// After -- iterative retry with for loop
private async _performDownload(book: Book): Promise<void> {
  const store = useDownloadStore.getState()
  const bookId = book.id
  const maxRetries = 3

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Fresh controller per attempt -- avoids signal cross-talk between retries
    const controller = new AbortController()
    this.activeController = controller

    try {
      const url = await this.resolveDownloadUrl(book)
      const response = await fetch(url, { signal: controller.signal })
      // ... stream to storage ...
      return // Success -- exit the loop and method
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      if (attempt < maxRetries) {
        store.setDownloadState(bookId, {
          status: 'retrying',
          retryCount: attempt + 1,
          error: (err as Error).message,
        })
        // Abortable retry timer
        const delay = Math.pow(2, attempt + 1) * 1000
        await new Promise<void>((resolve, reject) => {
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null
            resolve()
          }, delay)
          controller.signal.addEventListener('abort', () => {
            if (this.retryTimer) {
              clearTimeout(this.retryTimer)
              this.retryTimer = null
            }
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
        // Loop continues to next attempt
      } else {
        store.setDownloadState(bookId, {
          status: 'failed',
          error: (err as Error).message,
          retryCount: attempt + 1,
        })
      }
    } finally {
      // Only clear if this iteration's controller is still the active one
      if (this.activeController === controller) {
        this.activeController = null
      }
    }
  }
}

// After -- iterative queue drain with while loop
private async _drainQueue(): Promise<void> {
  while (true) {
    const store = useDownloadStore.getState()
    const pending = store.getPendingDownload()
    if (!pending) break

    const book = await db.books.get(pending.bookId)
    if (!book) break

    // TOCTOU guard: re-confirm state after await
    const currentState = useDownloadStore.getState().downloads.get(pending.bookId)
    if (!currentState || currentState.status !== 'pending') continue

    await this._performDownload(book)
  }
}
```

**Key design decisions for the iterative refactor:**

- **Fresh `AbortController` per retry attempt.** Each iteration creates a new controller so that retries do not share signal state. The `finally` block only clears the active controller reference if it matches the current iteration's controller, preventing a race where a fast retry iteration clears a different iteration's reference.

- **Abortable retry timer.** The retry delay (`setTimeout`) is wrapped in a `Promise` that also listens for abort signals. When `cancelDownload()` aborts the active controller, the retry timer promise rejects with `AbortError`, which is caught by the `(err as Error).name === 'AbortError'` check — causing the method to exit immediately without marking the download as failed.

- **Exponential backoff.** The delay is `Math.pow(2, attempt + 1) * 1000` — 2s, 4s, 8s for 3 retries. The first retry is at attempt 1 (not 0), so the delay starts at 2s, not 1s.

- **TOCTOU guard in queue drain.** Between fetching the pending download and confirming it with `db.books.get()`, a concurrent `cancelDownload()` could have removed or paused it. The guard re-checks the store after the await and skips with `continue` if the state is no longer `'pending'`.

- **The `for` loop uses `return` (not `break`) on success.** This exits both the loop and the method. On failure after exhausting all retries, the loop completes and the method falls through (returns `undefined` naturally — the download is marked as `'failed'` inside the last catch block).

**When to use this pattern:**
- Any retry loop with a known maximum iteration count — `for` is more idiomatic than recursion
- Any serialized queue drain — `while (true)` with explicit `break` conditions is clearer than tail recursion
- When combining retry with abort semantics, the iterative pattern avoids the footgun of an aborted controller being passed to the next recursive call

## Why This Matters

These three patterns emerged from a post-ship review of the offline downloads feature. Each represents a concrete fix for a gap that would have caused real user-facing issues:

1. **IndexedDB fallback** prevents complete feature failure on environments where OPFS is unavailable — without it, the download feature is non-functional on those platforms. The chunked storage pattern is generalizable beyond downloads (any stream-to-IDB use case).

2. **TransformStream progress** fixes a UX gap where the progress ring appeared stuck at 0% during streaming writes for large files. While the download completed correctly, the lack of visible progress violated user expectations and would have been flagged in UX review as a perceived hang.

3. **Iterative retry** eliminates a theoretical stack overflow risk and aligns with project robustness conventions. The recursive pattern was "safe enough" in practice but violated the principle of using the right control flow for the job — `for` for bounded iteration, `while` for conditional iteration.

All three fixes were validated by 23 new unit tests and 7 new E2E tests covering the download lifecycle, cancel, retry, queue serialization, error paths, and full download-to-offline-read flows.

## When to Apply

- When designing a service with an OPFS primary path, plan the IDB fallback from the start — retrofitting storage backends after shipping is harder than designing the abstraction upfront
- When using `pipeTo()` for streaming writes, add the TransformStream progress interception during initial implementation, not as a post-ship fix — it requires careful integration with the stream lifecycle and is harder to test retroactively
- When writing retry logic, default to `for` loops (not recursion) — the iteration count is always bounded and known, which is the exact use case `for` was designed for
- When writing serialized queue drain, prefer `while (true)` with documented break conditions over tail recursion — the queue depth is dynamic (while-loop) and the iteration count is unknown before execution
- Add abort signal handling to retry timers from the start — retrofitting cancellation into a retry loop is delicate because each attempt creates a new controller that must be correctly wired to the timer promise
- The TOCTOU guard pattern (re-checking state after an `await`) applies broadly wherever asynchronous operations can race with concurrent state mutations — it is not specific to downloads

## Related

- PR [#569](https://github.com/PedroLages/knowlune/pull/569) — Offline Book Downloads (merged)
- Commit `272b77ec` — Gap fix commit with IndexedDB fallback, TransformStream progress, and iterative retry
- Plan: `docs/plans/2026-05-07-015-feat-offline-book-downloads-plan.md`
- Requirements: `docs/brainstorms/2026-05-07-offline-book-downloads-requirements.md`
- Source file: `src/services/OpfsStorageService.ts` — `storeStreamToBookFile()` method
- Source file: `src/services/DownloadManager.ts` — `_performDownload()` and `_drainQueue()` methods
- Related solution file: `docs/solutions/best-practices/book-detail-page-implementation-lessons-2026-05-07.md` — five-tier similarity design patterns for download UI consistency
- Related solution file: `docs/solutions/e120-pwa-polish-lessons.md` — PWA polish lessons, relevant for persistent storage patterns

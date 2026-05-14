---
title: "IndexedDB streaming fallback and TransformStream progress tracking for large file downloads"
date: 2026-05-14
category: best-practices
module: offline-books
problem_type: best_practice
component: documentation
severity: medium
applies_when:
  - Implementing large file downloads in the browser where OPFS may not be available or preferred
  - Needing incremental progress reporting through ReadableStream pipeTo
tags:
  - indexeddb
  - filestream
  - transformstream
  - pipeto
  - progress-tracking
  - storage-fallback
  - offline-downloads
---

# IndexedDB streaming fallback and TransformStream progress tracking for large file downloads

## Context

The offline book downloads feature ships ebook files (EPUB/PDF) from a remote server to the browser for offline reading. The original implementation used OPFS (Origin Private File System) via `navigator.storage.getDirectory()`, but it turned out the `DownloadManager._performDownload()` method bypassed `OpfsStorageService` entirely with direct OPFS calls. When OPFS was not viable (browser compatibility, PWA storage limits), an IndexedDB fallback was needed. Additionally, `pipeTo()` on a `ReadableStream` does not report incremental progress by default -- progress jumps from 0 to total size.

These patterns emerged from five "shipped-with-gaps" fixes post-merge (PR #569, plan `docs/plans/2026-05-07-015-feat-offline-book-downloads-plan.md`).

## Guidance

### Pattern 1: IndexedDB per-chunk streaming with `.part.NNNNNN` convention

Use IndexedDB to store large binary files by splitting the download stream into chunks, each stored as a separate record keyed by `filename.part.NNNNNN` (zero-padded, 6 digits). Reassemble on read by ordering parts lexicographically.

**Store function pattern:**

```typescript
async storeStreamToBookFile(
  bookId: string,
  filename: string,
  stream: ReadableStream,
  totalSize: number,
  onProgress: (loaded: number) => void
): Promise<void> {
  const CHUNK_SIZE = 256 * 1024; // 256 KiB chunks
  let partIndex = 0;
  const reader = stream.getReader();
  const db = await this._getDb();
  const tx = db.transaction('bookFiles', 'readwrite');
  const store = tx.objectStore('bookFiles');

  // Delete any existing parts for this file first
  const existingParts = await store.index('filename')
    .getAll(IDBKeyRange.only(`${bookId}::${filename}`));

  const deletePromises = existingParts.map((record: any) =>
    store.delete(record.id)
  );
  await Promise.all(deletePromises);

  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const key = `${bookId}::${filename}.part.${String(partIndex).padStart(6, '0')}`;
    store.put({ id: key, filename: key, data: value });
    loaded += value.byteLength;
    onProgress(loaded);
    partIndex++;
  }

  await tx.done;
}
```

**Read function pattern (backward compatible with legacy single-record format):**

```typescript
async readBookFile(bookId: string, filename: string): Promise<Uint8Array | null> {
  const db = await this._getDb();
  const tx = db.transaction('bookFiles', 'readonly');
  const store = tx.objectStore('bookFiles');

  // Try legacy single-record format first
  const legacyKey = `${bookId}::${filename}`;
  const legacyRecord = await store.get(legacyKey);
  if (legacyRecord) return legacyRecord.data;

  // Try chunked format: collect all .part.NNNNNN records
  const prefix = `${bookId}::${filename}.part.`;
  const allRecords = await store.index('filename')
    .getAll(IDBKeyRange.bound(prefix, prefix + '￿'));

  if (allRecords.length === 0) return null;

  // Sort by part number (keys are naturally sorted since zero-padded)
  allRecords.sort((a, b) => a.id.localeCompare(b.id));
  const totalSize = allRecords.reduce((sum, r) => sum + r.data.byteLength, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const record of allRecords) {
    result.set(new Uint8Array(record.data), offset);
    offset += record.data.byteLength;
  }
  return result;
}
```

### Pattern 2: TransformStream interceptor for pipeTo progress

`ReadableStream.pipeTo(writableStream)` does not emit intermediate progress events -- the caller only learns completion. To get incremental progress, insert a `TransformStream` that counts bytes as they pass through.

```typescript
function createProgressStream(
  totalSize: number,
  onProgress: (loaded: number) => void
): TransformStream<Uint8Array, Uint8Array> {
  let bytesSoFar = 0;
  return new TransformStream({
    transform(chunk, controller) {
      bytesSoFar += chunk.byteLength;
      onProgress(bytesSoFar);
      controller.enqueue(chunk);
    },
    flush() {
      // Ensure final progress callback reports full size
      onProgress(totalSize);
    }
  });
}

// Usage:
async function downloadWithProgress(
  response: Response,
  onProgress: (loaded: number) => void
): Promise<void> {
  if (!response.body) throw new Error('No response body');

  const totalSize = Number(response.headers.get('Content-Length')) || 0;
  const progressStream = createProgressStream(totalSize, onProgress);
  const responseStream = response.body;

  // Inject progress tracking between the response and the storage stream
  await responseStream
    .pipeThrough(progressStream)
    .pipeTo(myWritableStream);
}
```

### Pattern 3: Iterative retry instead of recursive retry

`_performDownload` initially called itself recursively on retry, risking stack overflow on repeated failures. Convert to a `for()` loop with a fresh `AbortController` per attempt:

```typescript
async _performDownload(url: string, destination: string): Promise<void> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const abortController = new AbortController();
    try {
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // ... process response ...
      return; // success
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      // wait before retry
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
```

### Pattern 4: TOCTOU-safe drain queue

After `await db.books.get(bookId)`, the download state may have changed (user cancelled, another tab modified, etc.). Always re-fetch the store state before acting on the fetched record:

```typescript
async processDownload(bookId: string): Promise<void> {
  const db = await this._getDb();
  const book = await db.books.get(bookId);
  if (!book || book.downloadStatus !== 'pending') return;

  // TOCTOU window: between get() and here, download may have been cancelled.
  // Re-fetch to confirm state is still valid.
  const currentBook = await db.books.get(bookId);
  if (!currentBook || currentBook.downloadStatus !== 'pending') return;

  // Safe to proceed
  await this._performDownload(currentBook.url, currentBook.filepath);
}
```

### Pattern 5: Plan-critic gate catches stale plan snapshots

The plan described "Create" for files that already existed. The plan-critic agent in the CE pipeline caught this mismatch before `ce:work` could duplicate existing code. This demonstrates the value of automated plan review before implementation.

## Why This Matters

- **IndexedDB streaming**: Avoids storing entire files in memory while still enabling PWA offline access. The `.part.NNNNNN` convention is simple, backward-compatible, and requires no external migration tooling. Without it, you either blow memory limits or lose OPFS-fallback entirely.
- **TransformStream progress**: Without this pattern, large-download UIs show a spinner that jumps from 0% to 100% at the end -- a poor UX that provides no feedback during multi-megabyte transfers. The pattern is a one-time cost that pays off every download.
- **Iterative retry**: Recursive retry creates a hidden stack depth cost and makes error propagation harder to trace. A `for()` loop is explicit, bounded, and debuggable.
- **TOCTOU re-fetch**: IndexedDB is async and shared across tabs/workers. Always assume state can change between any two awaits.
- **Plan-critic gate**: Prevents wasted implementation effort when plans drift from reality. Cheap automated check before expensive code generation.

## When to Apply

- **Pattern 1**: When downloading files >1MB for offline use and you need OPFS fallback. The 256 KiB chunk size works well; tune based on typical file sizes and IndexedDB transaction limits (browsers cap at ~2GB total per origin).
- **Pattern 2**: Any time you use `pipeTo()` and need progress reporting. The `pipeThrough()` API is standard and works in all modern browsers.
- **Pattern 3**: Any fetch-with-retry logic. Default to iterative; only use recursive retry if you have a specific reason (and even then, reconsider).
- **Pattern 4**: Any code that reads then writes from IndexedDB or any shared async store. Always re-read before writing if the value may have changed.
- **Pattern 5**: Always run the plan-critic gate before implementation. When a plan says "Create" for a file, verify the file doesn't already exist.

## Examples

**Before (no progress -- jumps 0 to total):**

```typescript
// progress goes from 0 to total after pipeTo resolves
await response.body!.pipeTo(writableStream);
```

**After (incremental progress via TransformStream):**

```typescript
const progressStream = new TransformStream<Uint8Array, Uint8Array>({
  transform(chunk, controller) {
    bytesSoFar += chunk.byteLength;
    downloadProgress(bytesSoFar / totalSize);
    controller.enqueue(chunk);
  }
});
await response.body!.pipeThrough(progressStream).pipeTo(writableStream);
```

**Before (direct OPFS bypass -- no fallback):**

```typescript
// _performDownload called navigator.storage.getDirectory() directly
const root = await navigator.storage.getDirectory();
const fileHandle = await root.getFileHandle(filename, { create: true });
```

**After (IndexedDB streaming fallback with chunked storage):**

```typescript
await this.storeStreamToBookFile(bookId, filename, response.body, totalSize, onProgress);
```

## Related

- PR #569: [Offline book downloads (shipped-with-gaps)](https://github.com/PedroLages/knowlune/pull/569)
- Plan: [docs/plans/2026-05-07-015-feat-offline-book-downloads-plan.md](../../plans/2026-05-07-015-feat-offline-book-downloads-plan.md)
- Dexie 4 quirks including IndexedDB behavior (auto memory [claude]): [reference_dexie_4_quirks.md](../../../.claude/projects/-Volumes-SSD-Dev-Apps-Knowlune/memory/reference_dexie_4_quirks.md)

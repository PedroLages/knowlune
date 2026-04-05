# Performance Benchmark — E88-S03: Remote EPUB Streaming (2026-04-05)

## Bundle Analysis

Build completed in ~60s. No new dependencies added. `BookContentService.ts` is a lightweight module (~230 lines) using only native browser APIs (fetch, Cache API, AbortController).

Bundle sizes unchanged from baseline:
- `index-DFYQDsu5.js`: 749.10 KB (gzip: 214.26 KB)
- `sql-js-58qODPCf.js`: 1,304.88 KB (gzip: 450.98 KB)

No bundle regression detected.

## Runtime Performance

- **Fetch timeout**: 30s (`FETCH_TIMEOUT_MS`) — reasonable for large EPUB files over slow connections
- **Cache eviction**: O(n) reads for LRU check where n = MAX_CACHED_BOOKS (10). At 10 entries, this is negligible (<1ms)
- **Blob URL management**: Proper `URL.revokeObjectURL()` calls prevent memory leaks on re-loads and unmount
- **Non-blocking cache write**: Cache write after successful fetch uses `.catch()` to avoid blocking the main content display

## Verdict

No performance regressions. No new dependencies. Cache strategy is bounded at 10 entries with proper eviction.

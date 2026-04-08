## External Code Review: E107-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-07
**Story**: E107-S01

### Findings

#### Blockers

- **src/app/hooks/useBookCoverUrl.ts:54-55 (confidence: 92)**: **Blob URL returned by `getCoverUrl()` is never revoked.** The `blobUrl` local variable captures the resolved URL, but it's only assigned to `previousUrlRef.current` inside the `if (!isCancelled)` block. The cleanup function revokes `previousUrlRef.current` — which is the *previous* effect's URL, not the *current* one. In the normal flow (component unmounts, no URL change), the current effect sets `previousUrlRef.current = blobUrl` in the resolve function, and the cleanup runs on unmount revoking it — this works. **However**, if the resolve completes after a re-render triggers a new effect (the `isCancelled` flag is set, so the assignment to `previousUrlRef` is skipped), the `blobUrl` from `getCoverUrl()` is **leaked** — it's never revoked because it was never stored in `previousUrlRef`. This means every time the component re-renders with new props while a previous resolution is in-flight, a blob URL leaks. Fix: Always capture the current effect's blob URL for cleanup, regardless of cancellation:
```typescript
// Track blobUrl at the effect scope level for cleanup
return () => {
  isCancelled = true
  // Revoke the blob URL from THIS effect, not just previousUrlRef
  const urlToRevoke = previousUrlRef.current
  if (urlToRevoke && urlToRevoke.startsWith('blob:')) {
    URL.revokeObjectURL(urlToRevoke)
    previousUrlRef.current = null
  }
  // Also revoke if blobUrl was set but previousUrlRef wasn't updated (race)
  if (blobUrl && blobUrl !== urlToRevoke && blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl)
  }
}
```

#### High Priority

- **src/app/hooks/useBookCoverUrl.ts:82 (confidence: 88)**: **Missing dependency in useEffect dependency array.** The effect references `previousUrlRef` (writes to it on line 64), but `previousUrlRef` is excluded from the dependency array `[bookId, coverUrl]`. While refs don't need to be dependencies for *reads*, the effect writes `previousUrlRef.current = blobUrl` inside an async callback. If two effects run concurrently (due to rapid prop changes), both could write to `previousUrlRef.current`, and the cleanup of the first effect would revoke the *second* effect's blob URL. This is a classic concurrent-effect race condition. Fix: Use a local variable within the effect closure to track the blob URL for this specific invocation, and only update `previousUrlRef` atomically:
```typescript
useEffect(() => {
  let isCancelled = false
  let effectBlobUrl: string | null = null

  const resolveCoverUrl = async () => {
    if (!coverUrl) { /* ... */ return }
    if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) { /* ... */ return }
    try {
      const resolved = await opfsStorageService.getCoverUrl(bookId)
      effectBlobUrl = resolved
      if (!isCancelled) {
        setResolvedUrl(resolved)
      }
    } catch { /* ... */ }
  }

  resolveCoverUrl()

  return () => {
    isCancelled = true
    // Revoke THIS effect's blob URL
    if (effectBlobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(effectBlobUrl)
    }
  }
}, [bookId, coverUrl])
```
This eliminates `previousUrlRef` entirely and ensures each effect cleans up its own blob URL.

#### Medium

- **src/app/hooks/useBookCoverUrl.ts:68 (confidence: 75)**: **`previousUrlRef.current` is never cleared when coverUrl is set to an external URL or undefined.** If the hook transitions from an OPFS-resolved blob URL to an `https://` URL, the cleanup function will revoke the old blob URL — which is correct. But the assignment to `previousUrlRef.current` only happens inside the OPFS resolution branch (line 64). When transitioning from `https://` → `undefined`, `previousUrlRef.current` still holds the old blob URL from a prior OPFS resolution, and the cleanup will revoke it again (double-revoke). While `URL.revokeObjectURL` on an already-revoked URL is a no-op in most browsers, this is fragile and semantically incorrect. Fix: Clear `previousUrlRef.current` in all branches, or better, adopt the per-effect local variable approach from the High Priority finding above.

- **src/app/components/audiobook/AudioMiniPlayer.tsx:38 (confidence: 70)**: **Hook called with empty string `bookId` when `currentBookId` is null.** `useBookCoverUrl({ bookId: currentBookId ?? '', coverUrl: book?.coverUrl })` passes `''` as `bookId` when no audiobook is playing. If `coverUrl` is somehow still truthy (a stale value), the hook would call `opfsStorageService.getCoverUrl('')`, which may produce unexpected behavior or an error from the storage layer. Fix: Only invoke the hook when there's an actual book, or guard inside the hook:
```typescript
const resolvedCoverUrl = useBookCoverUrl({ 
  bookId: currentBookId ?? '', 
  coverUrl: currentBookId ? book?.coverUrl : undefined 
})
```

- **src/app/hooks/useBookCoverUrl.ts:55-66 (confidence: 65)**: **`null` returned by `getCoverUrl` is stored in `previousUrlRef` and later checked with `.startsWith('blob:')`.** If `opfsStorageService.getCoverUrl(bookId)` returns `null` (cover not found), line 64 sets `previousUrlRef.current = null`. This is fine — the `if` check on line 70 handles it. But if it returns an empty string `''`, line 64 sets `previousUrlRef.current = ''`, and the cleanup check `previousUrlRef.current.startsWith('blob:')` would throw a TypeError since `''` doesn't have `startsWith` in a null-safe way... Actually it does — empty string has `startsWith`. No runtime error, but worth noting the implicit assumption that `getCoverUrl` returns either a valid URL string or `null`.

#### Nits

- **src/app/hooks/__tests__/useBookCoverUrl.test.ts:133 (confidence: 55)**: The "re-creates blob URL when coverUrl changes" test verifies `getCoverUrl` was called with both book IDs, but doesn't verify that the first blob URL was revoked when switching to the second book. The separate "releases previous blob URL" test covers the undefined transition, but not the OPFS-to-OPFS transition case.

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 3 | Nits: 1

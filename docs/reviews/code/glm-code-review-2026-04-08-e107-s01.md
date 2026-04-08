## External Code Review: E107-S01 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-08
**Story**: E107-S01

Looking at this diff, I need to distinguish between actual code changes and documentation/review artifacts. The substantive changes are in the implementation files and the hook. Let me focus on the actual code.

### Findings

#### Blockers
- **src/app/hooks/useBookCoverUrl.ts:45-86 (confidence: 90)**: **Blob URL leaked when async resolution completes after effect cleanup.** The `blobUrl` local variable is declared in the effect scope but is only assigned to `previousUrlRef.current` inside the `if (!isCancelled)` guard. When a re-render triggers a new effect (setting `isCancelled = true`), the old effect's `blobUrl` from `getCoverUrl()` completes but never gets stored in `previousUrlRef`, so the cleanup function can't revoke it. In a list view with rapid scrolling (100+ books), each cancelled resolution leaks a blob URL (~50-500KB). Fix: Track the blob URL at the effect scope so cleanup always has access to it, regardless of cancellation:

```typescript
useEffect(() => {
  let isCancelled = false
  let effectBlobUrl: string | null = null

  const resolveCoverUrl = async () => {
    if (!coverUrl) {
      if (!isCancelled) setResolvedUrl(null)
      return
    }
    if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
      if (!isCancelled) setResolvedUrl(coverUrl)
      return
    }
    try {
      effectBlobUrl = await opfsStorageService.getCoverUrl(bookId)
      if (!isCancelled) {
        setResolvedUrl(effectBlobUrl)
      }
    } catch {
      if (!isCancelled) setResolvedUrl(null)
    }
  }

  resolveCoverUrl()

  return () => {
    isCancelled = true
    // Always revoke THIS effect's blob URL
    if (effectBlobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(effectBlobUrl)
    }
  }
}, [bookId, coverUrl])
```

This eliminates `previousUrlRef` entirely and guarantees each effect cleans up its own blob URL.

#### High Priority
- **src/app/hooks/useBookCoverUrl.ts:56-60 (confidence: 82)**: **`previousUrlRef.current` stale value can cause double-revoke or revoke of wrong URL.** Two concurrent effects both write to `previousUrlRef.current` (a shared ref). If effect A resolves, sets `previousUrlRef.current = blobA`, then effect B resolves and sets `previousUrlRef.current = blobB`, effect A's cleanup will revoke `blobB` (the current ref value), not `blobA`. Then effect B's cleanup tries to revoke `blobB` again — double-revoke. Meanwhile `blobA` is never revoked. Fix: Same as the blocker fix — use a per-effect local variable instead of a shared ref, so each effect's cleanup only touches its own blob URL.

#### Medium
- **src/app/hooks/useBookCoverUrl.ts:55-66 (confidence: 72)**: **`previousUrlRef.current` is never cleared when transitioning to external URL or null.** When `coverUrl` changes from `opfs-cover://book1` to `https://example.com/cover.jpg`, the effect sets `resolvedUrl` to the external URL but doesn't clear `previousUrlRef.current`. On the next cleanup, the stale blob URL gets revoked — correct by accident. But if the component unmounts with an external URL active, the cleanup revokes a blob URL from a prior effect invocation that may have already been cleaned up by a prior effect's return function. This is a latent correctness issue that becomes real if the ref-sharing fix isn't adopted. Fix: Adopt the per-effect-scoped variable approach from the blocker fix, which eliminates this class of issue entirely.

- **src/app/components/audiobook/AudioMiniPlayer.tsx:38 (confidence: 68)**: **Hook called with `bookId: ''` when no audiobook is playing.** The call `useBookCoverUrl({ bookId: currentBookId ?? '', coverUrl: book?.coverUrl })` passes an empty string as `bookId` when `currentBookId` is null. If `book?.coverUrl` is somehow truthy (stale Zustand state), the hook calls `opfsStorageService.getCoverUrl('')` which may produce unexpected behavior or errors in the storage layer. Fix: Conditionally suppress the cover URL when there's no active book:

```typescript
const resolvedCoverUrl = useBookCoverUrl({ 
  bookId: currentBookId ?? '', 
  coverUrl: currentBookId ? book?.coverUrl : undefined 
})
```

#### Nits
- **src/app/hooks/useBookCoverUrl.ts:47 (confidence: 75)**: Dead local variable `blobUrl` — assigned inside try block but the only consumers (`setResolvedUrl`, `previousUrlRef.current`) could use the await result directly. The variable exists solely to be accessible in the catch block, but the catch doesn't reference it. This becomes moot if the blocker fix is adopted (the variable becomes `effectBlobUrl` with an actual cleanup-time consumer).

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 2 | Nits: 1

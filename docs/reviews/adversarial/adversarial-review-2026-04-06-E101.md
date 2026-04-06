# Adversarial Review — Epic 101: Audiobookshelf Streaming & Learning Loop (MVP)

**Date:** 2026-04-06
**Reviewer:** Adversarial Review Agent (bmad-review-adversarial-general)
**Scope:** All 6 stories (E101-S01 through E101-S06), implementation artifacts, quality gate records

---

## Summary

Epic 101 ships a functional Audiobookshelf integration with a clean service layer, Zustand store, and E2E test suite. The architecture mirrors the OPDS pattern from E88, which is appropriate. However, there are 16 identifiable issues ranging from shipped-without-a-spec-gate defects to architectural time bombs that will create pain in future epics.

---

## Findings

### 1. S04 Shipped With Zero Quality Gates Passed

E101-S04 (`review_gates_passed: []`) has an empty quality gates list and was merged as `status: done`. This is not a technicality — it means the streaming playback story, which modifies `useAudioPlayer.ts` (a shared critical path used by every audiobook in the app), was never reviewed by lint, type-check, build, code review, or E2E. No other story in this epic, and no story in recent history, has shipped in this state. If this was intentional (e.g., covered by S03 review), it is nowhere documented. If it was an oversight, it is a regression risk against the entire audiobook feature surface.

### 2. E101-S02's connection.spec.ts Was Never Created

S02's task list (Task 7) explicitly called for `tests/e2e/audiobookshelf/connection.spec.ts` to test the server connection UI flow — including the "Test Connection" button, library selection checkboxes, server card CRUD, CORS troubleshoot collapsible, and HTTP warning. That file does not exist. The spec was apparently either deferred or forgotten. The browsing, streaming, bookmarks, and progress specs all assume a connected server in their `beforeEach` (seeded via `seedIndexedDBStore`), which means the connection flow itself — the critical onboarding path for every new user — has no automated coverage.

### 3. ABS Server Removal Leaves Orphaned Book Records Indefinitely

`removeServer(id)` in `useAudiobookshelfStore.ts` deletes the server record from Dexie but makes no attempt to clean up, mark, or orphan-flag the books with `absServerId === id`. The story's acceptance criteria explicitly states "associated cached book metadata is NOT deleted (preserving offline reference)" — which is a valid design decision — but there is no story, known issue, or comment tracking what happens to these orphaned books over time. They will appear in the Library without a valid source, their cover images will 404 silently, and attempting to stream them will fail with a generic network error rather than a clear "Server removed" message. This is not theoretical: any user who removes and re-adds a server will accumulate duplicates since the dedup logic (`absServerId + absItemId`) will fail to match records whose `absServerId` no longer resolves.

### 4. Podcast Libraries Are Silently Included in the Audiobook Sync

The ABS `AbsLibrary.mediaType` can be `'book'` or `'podcast'`. The library selection UI in `AudiobookshelfServerForm.tsx` shows all libraries with the mediaType in small text (line 215), but does not filter or warn when the user selects a podcast library. `useAudiobookshelfSync.ts` contains no `mediaType` filtering — it will attempt to sync podcast episodes as `Book` records with `format: 'audiobook'`, mapping podcast episode metadata (which has a different API shape than audiobook metadata) into the `AbsLibraryItem` schema. This will produce malformed Book records with missing or incorrect authors, durations, and chapters. No NFR or AC addresses this case.

### 5. API Key Stored in `ContentSource` Alongside the `source.url`

The `narrator` field mapping in `useAudiobookshelfSync.ts` notes: `coverUrl: getCoverUrl(server.url, absItem.id) + '?token=' + server.apiKey`. This embeds the bearer token directly in the `coverUrl` string stored in the Book record in Dexie. Combined with the `?token=` pattern in `getStreamUrl`, the API key now appears in three separate places in the persisted data: `audiobookshelfServers.apiKey`, `books[n].coverUrl` (as a query param), and the constructed stream URL. The security note in `types.ts` acknowledges plaintext storage as acceptable for local-first, but it explicitly ties the encryption-before-cloud-sync requirement to `apiKey` only. The coverUrl token leak is untracked, making pre-sync encryption incomplete.

### 6. No Version Compatibility Enforcement Against the NFR15 Minimum

NFR15 specifies ABS v2.26.0+ as the minimum supported server version. `testConnection()` returns `{ serverVersion: string }` and the UI displays it in the success message, but neither the service nor the UI validates that the version meets the minimum. A user running ABS v2.19 will successfully connect, select libraries, and proceed into sync — where the API shape differences (e.g., `narrators` typed as `string[]` in older versions vs. `{ name: string }[]` in newer ones) will cause silent data degradation. The narrator-handling workaround in `useAudiobookshelfSync.ts` (the `rawNarrators` union type cast) acknowledges this divergence but applies it universally rather than branching on detected version.

### 7. No Auto-Sync Trigger or Staleness Strategy

The epic delivers a manual sync model with no staleness detection. `useAudiobookshelfSync.ts` exposes a `syncCatalog()` function that must be called explicitly, but neither the library page nor any background hook calls it automatically after the initial load. The `lastSyncedAt` field exists on `AudiobookshelfServer` but nothing reads it to decide when to re-sync. A user who adds a new audiobook to their ABS server will never see it in Knowlune unless they navigate to settings and manually trigger a sync — a workflow that is not documented, not surfaced in the UI, and not obvious to users who expect library apps to stay current.

### 8. All Burn-In Validations Are False Across All 6 Stories

Every story in the epic has `burn_in_validated: false`. Burn-in testing was introduced specifically to catch flakiness in E2E tests involving audio playback, IndexedDB seeding, and timing-sensitive assertions. The streaming and progress specs interact with HTML5 `<audio>` elements and `timeupdate` events — historically among the most flaky test surfaces in the browser. Skipping burn-in for the entire epic means flakiness will be discovered in CI at the worst possible time, not proactively.

### 9. Progress Is Saved to Dexie But Never Synced Back to the ABS Server

`updateProgress()` is exported from `AudiobookshelfService.ts` and `fetchProgress()` is implemented, but neither is called anywhere in the application code. Listening progress is stored exclusively in the local Dexie `books` table. A user who listens on Knowlune and then opens their ABS mobile app will see no progress. A user who listens on the ABS mobile app and then opens Knowlune will have their ABS progress overwritten by the local Dexie state on next sync (since `useAudiobookshelfSync.ts` uses `existing.progress` as a fallback, but does not call `fetchProgress` to retrieve the authoritative server state). The `updateProgress` stub is not a stub — it is fully implemented — but it is wired to nothing.

### 10. `PostSessionBookmarkReview` Fires on Every Pause, Not Only on Session End

`AudiobookRenderer.tsx` triggers `setPostSessionOpen(true)` when `isPlaying` transitions to `false` with `sessionBookmarks.length > 0`. The comment acknowledges "Simple pauses should not open the post-session review" and claims the trigger is "only on deliberate stop" — but the actual condition evaluates `isPlaying` becoming false, which includes every incidental pause (sleep timer firing mid-chapter, accidental tap, buffer stall). If a user creates a bookmark, then the audio briefly stalls to rebuffer over a LAN hiccup, the post-session panel will open mid-stream. This is a UX defect that will be experienced by any user on a marginally unstable connection.

### 11. MSW Audiobookshelf Handlers Were Never Created as a Shared Module

E101-S01 task 4.2 specified "Set up MSW server using `msw/node` with handlers for ABS endpoints" and S02 task 7.11 referenced `tests/support/msw/audiobookshelf-handlers.ts` as the shared location. That file does not exist. Each E2E spec duplicates its own `http.get` handler setup inline. When the ABS API shape changes (or when future epics add new endpoints), this duplication will require updates across 4+ spec files instead of one. This is exactly the tech debt pattern the `use-seeding-helpers` ESLint rule was written to prevent — but that rule covers IndexedDB seeding, not MSW handlers.

### 12. The `AbsSearchResult` Type Wraps Results Under a `book` Key, Which Is Never Used

`AbsSearchResult` is defined as `{ book: AbsLibraryItem[] }` and `searchLibrary()` is exported from the service. The search endpoint is wired to nothing in the UI — no Library search bar calls it, no hook routes through it. The story spec's search acceptance criteria (AC from S03: "results include both local and ABS books matching by title, author, or narrator") is implemented using the local Dexie `getFilteredBooks` with the `narrator` field added — the ABS server-side search is bypassed entirely. For 50-item libraries this is fine. For 200+ item libraries where S03 implements pagination, local search will only search the already-fetched page, silently missing results on unloaded pages.

### 13. S04 review_started Is Blank

Beyond the empty `review_gates_passed`, E101-S04's `review_started` field is also blank, which means there is no audit trail for when the story was reviewed or by whom. Given the story modifies `useAudioPlayer.ts` — a file that touches every audiobook user — the absence of a review record is a governance gap, not just a process one.

### 14. HTTP Security Warning Is Cosmetic, Not a Blocker

The UI shows a warning badge when `isInsecureUrl(url)` returns `true`, but the user can proceed without acknowledgment. There is no checkbox ("I understand my API key will be sent unencrypted"), no explicit consent capture, and no persistence of the acknowledgment. For a feature that transmits API keys over a LAN HTTP connection, the security posture is weaker than a typical "are you sure?" dialog. Local-first architecture does not eliminate the risk when the ABS server is on a different network segment or accessed via split-tunnel VPN.

### 15. Chapter Navigation for ABS Streaming Uses Index-Based Seeks, Not ABS Chapter Objects

S04 tasks assume chapter navigation works by seeking within the single stream URL using `audio.currentTime`. The `chapters` array on `Book` is populated from `absItem.media.chapters` during sync. However, ABS chapters use `{ start: number, end: number }` in seconds — which works correctly only when the stream is a single continuous file. ABS also supports multi-file audiobooks (one file per chapter), where each chapter is a separate `libraryFile` with its own streaming URL. The implementation assumes single-file layout without documenting this limitation or checking `libraryFiles.length > 1`. Multi-file audiobooks will have incorrect chapter navigation (seeking to the wrong position in the single stream that only contains the first file).

### 16. The `AbsItem` Type Is Defined as an Empty Extension and Is Immediately Stale

`AbsItem extends AbsLibraryItem` with no additional fields and a comment "Extended in E102+ if needed." E102 stories (E102-S01 through E102-S04) are already in the sprint status. If E102 extends `AbsItem` with additional fields, it will require a type change that may conflict with code in E101 that already assumes `AbsItem === AbsLibraryItem`. The empty extension creates a false impression that `AbsItem` is structurally different from `AbsLibraryItem`, while in practice any code that accepts `AbsLibraryItem` can be passed an `AbsItem` without knowing it. This is not a future concern — it is technical debt that was pre-loaded into the type system on day one.

---

## Critical Issues (Blocking or High Risk)

1. **S04 shipped with zero quality gates** — regression risk against entire audiobook playback surface
2. **No connection.spec.ts** — onboarding flow (highest user impact, first-run path) has zero E2E coverage
3. **Orphaned books on server removal** — will produce silent 404s, streaming failures, and dedup corruption on re-add
4. **Podcast libraries silently synced as audiobooks** — corrupted Book records from incompatible metadata shape
5. **Progress never synced back to ABS server** — `updateProgress()` is wired to nothing; cross-device continuity is broken
6. **PostSessionBookmarkReview fires on any pause** — UX defect on unstable connections, reproduced by sleep timer

---

*Report generated by adversarial review agent — Epic 101, 2026-04-06*

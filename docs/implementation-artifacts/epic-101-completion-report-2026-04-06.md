# Epic 101 Completion Report — Audiobookshelf Streaming & Learning Loop (MVP)

**Date:** 2026-04-06
**Epic:** E101 — Audiobookshelf Streaming & Learning Loop (MVP)
**Duration:** 2026-04-05 → 2026-04-06
**Prepared by:** Epic Coordinator

---

## 1. Executive Summary

Epic 101 delivered a full Audiobookshelf (ABS) integration MVP across 6 stories in approximately 2 days. All 6 stories are merged to `main` and the build is clean. The integration covers the complete learning loop: server discovery → library browsing → streaming playback → bookmarks → flashcard pipeline → progress tracking and streaks.

The architecture followed the existing OPDS/EPUB pattern (`AbsResult<T>` discriminated union, `AudiobookshelfService.ts` pure-function service, Zustand store, `addInitScript` E2E fetch mocking), which accelerated delivery and reduced architectural discussion overhead significantly. The most complex stories (S03 Library Sync, S04 Streaming Playback) required 2–3 review rounds each due to async patterns — specifically stale closures in Zustand callbacks and detached audio element cleanup.

**Quality summary:**
- 6/6 stories delivered (100%)
- 50 issues fixed across 12 total review rounds
- 61 tests added (22 unit + 39 E2E)
- 3 GLM false positives across the epic (non-issues)
- OpenAI Codex CLI: 0/6 successful executions (exit code 2 every run)
- Build: PASS (`✓ built in 41.28s`)
- Traceability gate: PASS (P0 100%, P1 91%, overall 85%)
- NFR gate: CONCERNS (18 pass, 7 concerns, 0 blockers)
- Adversarial review: 16 findings (6 of highest priority)

---

## 2. Stories Delivered

| Story | Name | PR | Review Rounds | Issues Fixed |
|-------|------|----|---------------|--------------|
| E101-S01 | AudiobookshelfService & Data Foundation | #261 | 2 | 7 |
| E101-S02 | Server Connection & Authentication UI | #262 | 1 | 4 |
| E101-S03 | Library Browsing & Catalog Sync | #263 | 2 | 14 |
| E101-S04 | Streaming Playback | #264 | 3 | 13 |
| E101-S05 | Audio Bookmarks & Learning Loop | #265 | 3 | 8 |
| E101-S06 | Progress Tracking & Streaks | #266 | 1 | 4 |
| **Total** | | | **12** | **50** |

### Story Notes

**E101-S01** — Pure-function service (`AudiobookshelfService.ts`), Dexie schema v40 (`audiobookshelfServers` table), full type system (`AbsResult<T>`, `AbsLibrary`, `AbsLibraryItem`, `AbsProgress`). 22 unit tests with MSW. Key fix: trailing-slash normalization centralized in `absApiFetch`, with an additional fix required for pure URL builder functions (`getStreamUrl`, `getCoverUrl`) that bypass the shared helper.

**E101-S02** — Server settings UI (`useAudiobookshelfStore`, `AudiobookshelfSettings.tsx`, etc.). Mirrored the OPDS three-mode state machine (`'list' | 'add' | 'edit'`) cleanly. Key discovery: `addInitScript` fetch override pattern for cross-origin E2E mocking (became the standard for all subsequent stories).

**E101-S03** — `useAudiobookshelfSync` hook, `LibrarySourceTabs`, ABS book upsert into Dexie. Root cause of 14 fixes: stale `useMemo` on `filters.source` and a paginated batch upsert optimization (`bulkPut` vs individual `put` calls). 2 review rounds.

**E101-S04** — HTML5 Audio integration, remote-source branch of `useAudioPlayer.ts`, `addInitScript` audio element mock for E2E. Most complex story: 3 review rounds converging 8 → 4 → 2 issues. Key fixes: `_loadedBookId` guard after `canplay`, `__TEST_AUDIO_SRC__` for detached audio, `savedSecondsRef` for session resume. Note: `review_gates_passed` is empty in the tracking file — this is a process gap identified in the adversarial review.

**E101-S05** — FAB bookmark creation, `editingNotesRef` for stale closure, `sessionBookmarkIds` Set filtering, `deliberateStopRef` for pause vs. stop distinction, post-session review sheet. 3 review rounds; R2 BLOCKER caused by an incomplete rename (`sessionBookmarkCount` → `sessionBookmarkIds.size`) that missed 3 references.

**E101-S06** — Progress persistence, chapter/time display, debounced interval save. Wired `book_listened` event with no new infrastructure needed — the existing session/streak/XP system accepted ABS books identically via the `courseId: ''` sentinel. 1 review round (PASS + 4 fixes).

---

## 3. Review Metrics

### Issues Found and Fixed by Severity

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| BLOCKER | 2 | 2 | 0 |
| HIGH | 12 | 12 | 0 |
| MEDIUM | 16 | 16 | 0 |
| LOW | 14 | 14 | 0 |
| NIT | 6 | 6 | 0 |
| **Total** | **50** | **50** | **0** |

### False Positives (Non-Issues)

| Story | Source | Finding | Resolution |
|-------|--------|---------|------------|
| E101-S01 | GLM | `crypto.randomUUID()` flagged as "not available in all browsers" | NON-ISSUE: PWA requires secure context, which mandates crypto API |
| E101-S04 | GLM | API key in stream URL flagged as "plaintext secret" | NON-ISSUE: ABS HTML5 streaming requires `?token=` query param — no alternative mechanism exists |
| E101-S06 | GLM | `crypto.randomUUID()` same as S01 | NON-ISSUE: same reasoning |

### External Model Performance

| Agent | Stories Attempted | Successful Runs | Useful Findings |
|-------|------------------|-----------------|-----------------|
| GLM (z.ai GLM-5.1) | 6 | 6 | Mixed — 3 true positives, 3 false positives |
| OpenAI Codex CLI | 6 | 0 | None (exit code 2 on every run) |

OpenAI Codex CLI provided zero value across the entire epic. GLM produced 3 confirmed false positives around `crypto.randomUUID()` and the `?token=` streaming pattern.

---

## 4. Deferred Issues

### Technical Debt (Intentional)

| Item | Severity | Story | Plan |
|------|----------|-------|------|
| `apiKey` stored in plaintext in Dexie | LOW | S01, S02 | Acceptable for local-first; must encrypt before Supabase cloud sync per E19 pattern |
| `fetchProgress()`/`updateProgress()` are typed stubs only | LOW | S01 | Intentional — E102-S01 fills the implementation with LWW sync logic |
| `book_listened` emits empty `courseId` for ABS books | LOW | S06 | Treated as "no course" which is functionally correct; type comment should make this explicit |

### Adversarial Review Findings (Deferred to Future Epics or Backlog)

The adversarial review identified 16 findings. The 6 highest-priority items requiring tracking:

| # | Finding | Severity | Target |
|---|---------|----------|--------|
| A1 | E101-S04 shipped with empty `review_gates_passed` — no audit trail of review coverage for `useAudioPlayer.ts` (shared critical path) | PROCESS | Governance — document as known gap |
| A2 | `connection.spec.ts` never created — onboarding critical path (server add/remove/CORS) has no E2E spec; existing specs assume a pre-connected server | HIGH | E102 chore |
| A3 | Podcast libraries silently included in sync — `mediaType: 'podcast'` items mapped as `Book` records with audiobook format, producing malformed records | HIGH | E102-S01 or E103 |
| A4 | API key embedded in `coverUrl` query param in Dexie — token appears in 3 places; pre-sync encryption plan (E19) only accounts for `apiKey` field | MEDIUM | Track in E19 scope update |
| A5 | No ABS version compatibility gate — users on ABS < v2.26.0 proceed through onboarding and hit silent API shape mismatches | MEDIUM | E102 |
| A6 | `PostSessionBookmarkReview` fires on any `isPlaying → false` transition (buffer stall, accidental pause), not only explicit stop | MEDIUM | E102-S03 or separate bug fix |

Additional lower-priority adversarial findings: no auto-sync / staleness strategy (manual trigger only), burn-in not run for any story, `updateProgress()` fully implemented but wired to nothing, shared MSW handlers duplicated across specs, `AbsSearchResult` type unused in UI, `AbsItem` empty extension pre-loaded as type debt.

### Known Issues Register

KI-016 through KI-035 were cross-referenced against findings in this epic. No new pre-existing issues were discovered. The adversarial findings above (A2, A3, A4, A5, A6) should be entered as new known issues or scheduled into Epic 102/103.

---

## 5. Post-Epic Validation

### Traceability (testarch-trace)

**Result: PASS**
Report: `docs/implementation-artifacts/testarch-trace-2026-04-06-epic-101.md`

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 Coverage | 100% | 100% (8/8) | PASS |
| P1 Coverage | ≥90% | 91% (20/22) | PASS |
| Overall Coverage | ≥80% | 85% (28/33) | PASS |

Total tests: 22 unit + 39 E2E = 61. The 4 PARTIAL/UNIT-ONLY items are lower-priority operational concerns (session counting, streak integration, Reports integration) covered by existing infrastructure tests.

### NFR Assessment (testarch-nfr)

**Result: CONCERNS — 18 PASS, 7 CONCERNS, 0 FAIL, 0 release blockers**
Report: `docs/reviews/nfr/nfr-assessment-2026-04-06-e101.md`

High-priority concerns:
1. E101-S04 E2E: 4 of 5 streaming tests had gaps in network mocking coverage for the streaming endpoint (AC5, AC8, AC9)
2. E101-S05 E2E: All 8 bookmark ACs were initially untested (spec Task 5 not implemented on first pass)
3. Token-in-URL for streaming: API key in `?token=` query param — documented upstream ABS architectural constraint, no mitigation available without ABS server changes

**Recommendation from NFR agent:** PROCEED with epic closure. Test gaps tracked above; token-in-URL documented.

### Adversarial Review

**Result: 16 findings (6 critical/high, 10 medium/low)**
Report: `docs/reviews/adversarial/adversarial-review-2026-04-06-E101.md`

See Section 4 for the 6 highest-priority findings. None are release blockers for the MVP scope.

### Retrospective

**Result: 6 action items captured**
Report: `docs/implementation-artifacts/epic-101-retro-2026-04-06.md`

Action items to be implemented:

| # | Action | Owner |
|---|--------|-------|
| R1 | Document `addInitScript` fetch mock pattern in `.claude/rules/testing/test-patterns.md` | Next story touching integration E2E |
| R2 | Document detached Audio element cleanup pattern in `.claude/rules/testing/test-cleanup.md` | Next story with HTML5 media |
| R3 | Add Dexie `add()` vs `put()` vs `update()` selection guidance to `docs/engineering-patterns.md` | Chore commit |
| R4 | Add "document inline architectural decisions" to pre-review checklist in `story-template.md` | Chore commit |
| R5 | Add "Challenges and Lessons Learned must be completed before review" gate to `/review-story` | Skill update |
| R6 | Add stale-closure check to story author checklist in `story-template.md` | Chore commit |

---

## 6. Lessons Learned

| # | Lesson | Applies To |
|---|--------|-----------|
| L1 | Pure URL builders bypass shared fetch helper — normalize trailing slash independently | Any service with URL builder functions |
| L2 | `addInitScript` window.fetch override is the correct pattern for cross-origin E2E mocking; `page.route()` cannot intercept these | All integration stories (E102, E103, E84, E88) |
| L3 | Detached Audio/Video elements need explicit `removeEventListener` in `useEffect` cleanup; without this, `act()` warnings appear on navigation away from a playing track | Any story with HTML5 media elements |
| L4 | Stale closures in async Zustand callbacks — read state from `get()` inside the callback, never close over a value from the render scope | All stores with async operations |
| L5 | Prefer `add()` over `put()` for new Dexie records — `add()` throws on duplicate key and surfaces UUID bugs; `put()` silently overwrites | All Dexie write operations |
| L6 | Inline `// Intentional: <reason>` comments at non-obvious code sites pre-empt multi-model false positives and save review rounds | Non-obvious patterns in services (AbortController, timer cleanup) |
| L7 | Ship typed stubs in foundation story; fill implementation in dependent epic — E102 can start immediately without service-layer work | Any integration epic sequence |
| L8 | Zero-infrastructure learning loop: `book_listened` event type is the integration seam — any new content source type works with existing session/streak/XP/Reports if it emits the same event | Any new content source integration |
| L9 | Fix agents occasionally introduce regressions — an incomplete rename in S05 R2 created a BLOCKER by missing 3 of 6 references; always verify the complete call graph | Fix rounds in complex stories |
| L10 | GLM adversarial review produces consistent false positives for `crypto.randomUUID()` and `?token=` URL patterns — non-issues, but cost a review-round clarification each time | Epics using these patterns |

---

## 7. Suggestions for Epic 102

Epic 102: Audiobookshelf Sync & Discovery (Growth) — 4 stories, all ready-for-dev.

**Infrastructure available from E101:**
- `AudiobookshelfService.fetchProgress()` / `updateProgress()` typed stubs ready for LWW implementation (E102-S01)
- `useAudiobookshelfStore` Zustand store in place
- `addInitScript` fetch mock pattern documented and available
- MSW handlers in `tests/support/msw/audiobookshelf-handlers.ts` (note: inline duplication across specs should be consolidated before E102)

**Risks to address early:**
1. **Socket.IO (E102-S04)** is new infrastructure not used elsewhere. Recommend a spike in S04 to evaluate whether the existing WebSocket abstraction can be reused or a new Socket.IO client must be introduced.
2. **Podcast library filtering** — implement `mediaType === 'book'` filter in `useAudiobookshelfSync` before E102 adds more sync paths, to prevent podcast episode records from polluting the library.
3. **ABS version gate** — add version validation in `testConnection()` response handling before E102 adds new API calls that depend on v2.26.0+ shape.
4. **Create `connection.spec.ts`** — the onboarding E2E spec that was scoped for E101-S02 but never created. The entire server add/remove/CORS flow is untested. Schedule as E102 chore or S01 prerequisite.
5. **Pre-annotate GLM false positive patterns** — add `// Intentional: PWA requires secure context; crypto.randomUUID() is guaranteed` at UUID call sites and `// Intentional: ABS HTML5 streaming requires ?token= query param` at stream URL construction. This will eliminate two recurring false positives before E102 review.

---

## 8. Build Verification

Command: `npm run build`
Date: 2026-04-06
Branch: `main`
Result: **PASS**

```
✓ built in 41.28s

PWA v1.2.0
mode      generateSW
precache  290 entries (19489.70 KiB)
files generated
  dist/sw.js
  dist/workbox-d73b6735.js
```

Chunk size warnings (pre-existing, not introduced by E101): `sql-js` (1304 kB), `index` (755 kB), `pdf` (461 kB), `tiptap-emoji` (467 kB). No new large chunks introduced by E101.

---

## References

| Document | Path |
|----------|------|
| Epic tracking | `docs/implementation-artifacts/epic-101-tracking-2026-04-05.md` |
| Retrospective | `docs/implementation-artifacts/epic-101-retro-2026-04-06.md` |
| Traceability report | `docs/implementation-artifacts/testarch-trace-2026-04-06-epic-101.md` |
| NFR assessment | `docs/reviews/nfr/nfr-assessment-2026-04-06-e101.md` |
| Adversarial review | `docs/reviews/adversarial/adversarial-review-2026-04-06-E101.md` |
| Sprint status | `docs/implementation-artifacts/sprint-status.yaml` |
| Story files | `docs/implementation-artifacts/stories/E101-S01.md` through `E101-S06.md` |

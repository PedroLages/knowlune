# Requirements-to-Tests Traceability Matrix — Epic 88: OPDS Catalogs and Advanced Sources

**Date:** 2026-04-05
**Epic:** E88 — OPDS Catalogs and Advanced Sources
**Stories:** E88-S01, E88-S02, E88-S03, E88-S04
**Gate Decision:** CONCERNS

---

## Summary

| Metric | Value |
|--------|-------|
| Total ACs | 13 |
| ACs with direct test coverage | 9 |
| ACs with partial coverage | 1 |
| ACs with no test coverage | 3 |
| Overall Coverage | **~72%** |
| Unit test coverage | Strong (OpdsService, BookContentService, M4bParserService, useOpdsCatalogStore) |
| E2E coverage | S01 only — S02, S03, S04 have zero E2E specs |
| Integration test coverage | Dexie schema checkpoint (indirect) |

---

## Story E88-S01: OPDS Catalog Connection

### Acceptance Criteria

| AC | Statement | Unit | E2E | Integration | Status |
|----|-----------|------|-----|-------------|--------|
| S01-AC1 | Knowlune fetches catalog root feed and validates it is a valid OPDS Atom/XML document using DOMParser | `OpdsService.test.ts`: validates correct feed, rejects HTML, rejects invalid XML | `story-e88-s01.spec.ts`: form renders, Test Connection button visible | — | **COVERED** |
| S01-AC2 | If valid, catalog is saved with user-assigned name and optional basic auth credentials | `useOpdsCatalogStore.test.ts`: addCatalog with auth, persists to IDB | `story-e88-s01.spec.ts`: Save button enables when fields filled | — | **COVERED** |
| S01-AC3 | If invalid or unreachable, clear error message appears | `OpdsService.test.ts`: TypeError→CORS, AbortError→timeout, 401→auth required, 500→server error | — | — | **PARTIAL** (unit only, no E2E error flow tested) |
| S01-AC4 | User can manage multiple OPDS connections (add, edit, remove) | `useOpdsCatalogStore.test.ts`: add, update, remove, getCatalogById, only-removes-target | `story-e88-s01.spec.ts`: catalog list shows connected catalog, edit/remove buttons visible | — | **COVERED** |

**S01 Notes:**
- Auth header inclusion: covered in `OpdsService.test.ts` (with/without credentials)
- Schema migration: `schema-checkpoint.test.ts` confirms `opdsCatalogs` table added at v39
- E2E gap: the Test Connection button being clicked against a live/mocked server (success/error feedback) is not tested E2E. Only UI state (button enabled/disabled) is tested.
- Password visibility toggle: `story-e88-s01.spec.ts` covers toggle behavior

---

## Story E88-S02: OPDS Catalog Browsing and Import

### Acceptance Criteria

| AC | Statement | Unit | E2E | Integration | Status |
|----|-----------|------|-----|-------------|--------|
| S02-AC1 | OPDS catalog entries display in a browsable grid/list (cover, title, author, format, summary); pagination handles large catalogs via `next` link navigation | `OpdsService.test.ts` (fetchCatalogEntries): entry parsing, next link detection, navigation link separation, relative URL resolution | **NONE** | — | **PARTIAL** (no E2E for browse UI) |
| S02-AC2 | "Add to Library" creates a Book with `source: { type: 'remote', ... }`; no file copied to OPFS; metadata/cover from OPDS; "Remote" badge shown; duplicate prevention | — | **NONE** | — | **NOT COVERED** |

**S02 Critical Gaps:**
- No E2E spec file (`tests/e2e/regression/story-e88-s02.spec.ts` does not exist)
- `OpdsBrowser.tsx` component has no automated test at any level
- Remote source book creation (Book record with `source.type: 'remote'`) has no test
- Duplicate detection ("Add" button disabled if book already exists) has no test
- "Remote" badge rendering in `BookCard.tsx` has no test
- Toast "added to your library" notification has no test
- Format indicator display (EPUB/PDF badge) has no test
- Breadcrumb navigation for nested feeds has no test

---

## Story E88-S03: Remote EPUB Streaming

### Acceptance Criteria

| AC | Statement | Unit | E2E | Integration | Status |
|----|-----------|------|-----|-------------|--------|
| S03-AC1 | EPUB fetched from remote URL via `BookContentService.getEpubContent()`; auth credentials included; loading indicator shown | `BookContentService.test.ts`: routes remote to fetch, includes Basic auth header, omits when no credentials | **NONE** | — | **PARTIAL** (no E2E; loading indicator untested) |
| S03-AC2 | On server unreachable: error message displayed; if cached version exists, user offered "Read cached version" | `BookContentService.test.ts`: network/CORS error, hasCachedVersion=true/false, cache eviction (LRU 10 books) | **NONE** | — | **PARTIAL** (no E2E error UI flow) |
| S03-AC3 | Highlights, reading position, progress stored locally in Dexie; survive server unreachability; identical experience once loaded | — | **NONE** | — | **NOT COVERED** |

**S03 Critical Gaps:**
- No E2E spec file (`tests/e2e/regression/story-e88-s03.spec.ts` does not exist)
- Loading indicator "Loading from server..." during remote fetch: not tested
- Auth error (401/403) error message in BookReader UI: not tested
- Not-found (404) error message in BookReader UI: not tested
- "Read cached version" button appearing and functioning: not tested
- Local data persistence across server disconnect (S03-AC3): zero tests at any level
- BookReader integration with BookContentService: not tested

---

## Story E88-S04: M4B Audiobook Import

### Acceptance Criteria

| AC | Statement | Unit | E2E | Integration | Status |
|----|-----------|------|-----|-------------|--------|
| S04-AC1 | M4B file accepted by Import dialog; `music-metadata` lazy-loaded; chapters extracted; file stored in OPFS; Book record created with `format: 'audiobook'`, chapters, totalDuration | `M4bParserService.test.ts`: chapter extraction, sequential order, sampleOffset derivation, title/author/duration, filename fallback, unique chapter IDs, placeholder titles, single-chapter fallback | **NONE** | — | **PARTIAL** (import dialog flow and OPFS storage not tested E2E) |
| S04-AC2 | AudiobookRenderer plays M4B via HTML5 `<audio>`; chapter navigation seeks to `startTime`; all features (speed, sleep, bookmarks, Media Session) work identically | `M4bParserService.test.ts`: isSingleFileAudiobook detection, chapter progress detection from currentTime, formatAudioTime | **NONE** | — | **PARTIAL** (renderer integration and all feature interactions not tested E2E) |

**S04 Notes:**
- M4B chapter extraction is well-covered in unit tests (8 scenarios)
- `isSingleFileAudiobook` logic and chapter detection algorithm are unit-tested
- `formatAudioTime` formatting is unit-tested
- `music-metadata` lazy-loading behavior is not explicitly tested (bundle split verification)
- Cover art extraction has a test (null coverBlob when absent)

**S04 Critical Gaps:**
- No E2E spec file (`tests/e2e/regression/story-e88-s04.spec.ts` does not exist)
- Import dialog accepting `.m4b` files: not tested E2E
- "Parsing chapters..." progress indicator: not tested
- OPFS storage of M4B file: not tested
- AudiobookRenderer receiving M4B through `useAudioPlayer`: not tested
- Sleep timer "end of chapter" with single-file seek: not tested E2E
- Speed control with M4B: not tested E2E
- Bookmarks with M4B: not tested E2E
- Media Session API with M4B: not tested E2E
- S04 bug from code review (stale closure in handleEnded): no regression test added

---

## Coverage by Test Type

### Unit Tests (Vitest)

| File | Story | Coverage |
|------|-------|----------|
| `src/services/__tests__/OpdsService.test.ts` | S01 + S02 | validateCatalog: 10 cases; fetchCatalogEntries: 8 cases; getFormatLabel: 5 cases |
| `src/stores/__tests__/useOpdsCatalogStore.test.ts` | S01 | loadCatalogs, add, update, remove, getCatalogById, error states — 13 cases |
| `src/db/__tests__/schema-checkpoint.test.ts` | S01 | Schema version=39, opdsCatalogs table present — 4 cases |
| `src/services/__tests__/BookContentService.test.ts` | S03 | Routing, auth headers, 6 error codes, cache read/write/eviction — 14 cases |
| `src/services/__tests__/M4bParserService.test.ts` | S04 | Chapter extraction, single-file detection, progress detection, fallback — 22 cases |

**Total unit tests for E88: ~76 cases across 5 files**

### E2E Tests (Playwright)

| File | Story | Coverage |
|------|-------|----------|
| `tests/e2e/regression/story-e88-s01.spec.ts` | S01 | Dialog open, empty state, form navigation, button states, catalog list, edit/remove buttons, password toggle — 10 scenarios |
| ~~story-e88-s02.spec.ts~~ | S02 | **MISSING** |
| ~~story-e88-s03.spec.ts~~ | S03 | **MISSING** |
| ~~story-e88-s04.spec.ts~~ | S04 | **MISSING** |

### Integration Tests

| Area | Coverage |
|------|----------|
| Dexie schema migration | `schema-checkpoint.test.ts` confirms opdsCatalogs table at schema v39 |
| BookContentService + Cache API | MockCache integration within BookContentService.test.ts (inlined) |
| OpdsCatalogStore + Dexie (IDB) | `useOpdsCatalogStore.test.ts` uses `fake-indexeddb/auto` for real IDB behavior |

---

## Coverage Gaps Summary

### BLOCKERS (functionality completely untested end-to-end)

1. **S02: OpdsBrowser component** — No test at any level covers the browse UI, entry display, catalog selector dropdown, or pagination ("Load More").
2. **S02: "Add to Library" flow** — No test verifies that clicking "Add to Library" creates a Book record with `source.type: 'remote'`. This is a core AC.
3. **S02: Duplicate prevention** — No test verifies that the "Add" button is disabled for books already in the library.
4. **S03: Local persistence for remote books** — S03-AC3 ("highlights, position, progress survive server disconnect") has zero test coverage at any level.
5. **S04: E2E import and playback flow** — The entire user journey (import .m4b → see chapters → play → navigate) is untested end-to-end.

### HIGH (partial coverage, important user paths)

6. **S01-AC3: Error message display in UI** — OPDS validation errors (CORS, timeout, invalid URL) are unit-tested in the service but the error message rendering in OpdsCatalogSettings is not covered by E2E.
7. **S03-AC1: Loading indicator** — "Loading from server..." spinner during remote fetch is not tested.
8. **S03-AC2: "Read cached version" UI flow** — `hasCachedVersion` flag is unit-tested on the error object but the UI button appearing and functioning is not tested.
9. **S04-AC2: AudiobookRenderer single-file integration** — `isSingleFileAudiobook` is unit-tested in isolation but the full `useAudioPlayer` hook integration for M4B (including speed, sleep timer with chapter boundaries) is not tested.

### MEDIUM (nice-to-have coverage, risk is lower)

10. **S01: "Test Connection" live call result** — Only button state is tested; the actual success/error feedback shown after clicking is not.
11. **S02: "Remote" badge in BookCard** — No test verifies the badge renders for remote-source books in the Library view.
12. **S04: music-metadata lazy-loading** — No test verifies that `import('music-metadata')` is not included in the initial bundle.
13. **S04: S04 bug regression test** — The stale closure bug in `handleEnded` identified in code review has no regression test.

---

## Recommended Actions

| Priority | Action | Story |
|----------|--------|-------|
| P1 | Create `tests/e2e/regression/story-e88-s02.spec.ts` covering: browse dialog opens, entries render, "Add to Library" creates remote book, duplicate prevention disables button, "Remote" badge visible in library | S02 |
| P1 | Create `tests/e2e/regression/story-e88-s03.spec.ts` covering: remote book opens, loading indicator visible, error states (network, auth, not-found), "Read cached version" offered on failure | S03 |
| P1 | Add unit test for `BookContentService`: local data (highlights/progress) survives after server returns error (S03-AC3) | S03 |
| P1 | Create `tests/e2e/regression/story-e88-s04.spec.ts` covering: .m4b import via dialog, chapter list populated, playback seeks on chapter click | S04 |
| P2 | Add E2E test for OPDS Test Connection feedback (success toast + error inline message) | S01 |
| P2 | Add unit/component test for BookCard "Remote" badge rendering | S02 |
| P2 | Add regression test for `handleEnded` stale closure bug (S04 code review finding) | S04 |
| P3 | Add bundle analysis test or CI check for music-metadata lazy-load isolation | S04 |

---

## Gate Decision: CONCERNS

**Rationale:** Epic 88 has strong unit test coverage for service-layer logic (OpdsService, BookContentService, M4bParserService, useOpdsCatalogStore) but only one of four stories (S01) has an E2E spec. Three stories are missing E2E regression specs entirely. Two acceptance criteria (S02-AC2: remote book creation, S03-AC3: local persistence) have zero coverage at any level. The epic should not be considered fully validated until the P1 gaps are addressed. The unit tests provide sufficient confidence that the business logic is correct; the risk is undetected integration and UI breakage.

**Would gate as FAIL if:** This were a safety-critical or data-loss risk area. Since remote streaming and OPDS browsing are additive features (local books are unaffected by these gaps), CONCERNS is the appropriate gate rather than FAIL.

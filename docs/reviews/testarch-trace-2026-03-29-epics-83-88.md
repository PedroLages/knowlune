---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-03-29'
scope: Epics 83-88 (Books & Audiobooks Library)
epicRange: E83-E88
totalFRs: 43
totalStories: 31
totalEpics: 6
---

# Traceability Report: Epics 83-88 (Books & Audiobooks Library)

**Generated:** 2026-03-29
**Scope:** 43 Functional Requirements across 7 capability areas, 31 stories across 6 epics
**PRD:** `_bmad-output/planning-artifacts/prd-books-audiobooks-library-2026-03-29.md`
**Architecture:** `_bmad-output/planning-artifacts/architecture-books-audiobooks-library.md`
**Epics/Stories:** `_bmad-output/planning-artifacts/epics-books-audiobooks-library.md`

---

## Gate Decision: EXPECTED (Pre-Implementation)

**Rationale:** Epics 83-88 are not yet implemented. Zero tests exist for any of the 43 functional requirements. This traceability matrix serves as the **pre-implementation test planning baseline** -- mapping every FR to its implementing story and identifying the test strategy needed per story. Gate decision will be evaluated after each epic is implemented.

---

## Phase 1: Context Loading

### Source Documents Loaded

| Document | Status |
|----------|--------|
| PRD (43 FRs, 23 NFRs) | Loaded |
| Architecture document | Referenced |
| Epics/Stories (6 epics, 31 stories) | Loaded |
| Existing test suite | Scanned -- no book/EPUB/audiobook tests found |

### Capability Areas

| # | Capability Area | FRs | Epic(s) |
|---|----------------|-----|---------|
| 1 | Library Management | FR1-FR7 | E83 |
| 2 | EPUB Reading | FR8-FR12 | E84 |
| 3 | Highlighting and Annotation | FR13-FR18 | E85 |
| 4 | Flashcard Creation | FR19-FR23 | E85 |
| 5 | Reading Sessions and Streaks | FR24-FR27 | E85, E86 |
| 6 | Audiobook Playback | FR28-FR35 | E87 |
| 7 | Content Sources | FR36-FR39 | E88 |
| 8 | Highlight Review and Integration | FR40-FR43 | E86 |

---

## Phase 1: Test Discovery

### Existing Tests

No tests exist for Epics 83-88 features. The codebase has 90+ E2E spec files and 90+ unit test files, but none cover books, EPUB rendering, audiobook playback, OPDS catalogs, or book highlights. This is expected -- the feature is pre-implementation.

### Coverage Heuristics Inventory

- **API endpoint coverage:** Open Library API (FR5) and OPDS catalog (FR36-FR38) will need API-level tests or mocks
- **Auth/authz coverage:** OPDS catalog auth (FR36, E88-S01) requires positive and negative auth path tests
- **Error-path coverage:** Every import story (FR1, FR28, FR39) needs error path tests (invalid files, corrupt EPUBs, storage full). Reader stories (FR8, FR29) need error paths for missing files, OPFS failures, network timeouts.

---

## Phase 1: Traceability Matrix

### Legend

| Coverage | Meaning |
|----------|---------|
| NONE | No tests exist (pre-implementation) |
| Priority P0 | Core value prop -- must have 100% coverage |
| Priority P1 | Important -- target 90% coverage |
| Priority P2 | Supporting -- target 80% coverage |
| Priority P3 | Nice-to-have -- coverage optional |

### E83: Book Library and Import (FR1-FR7)

| FR | Requirement | Story | Priority | Coverage | Planned Test Levels |
|----|-------------|-------|----------|----------|-------------------|
| FR1 | Import EPUB files from local device | E83-S02 | P0 | NONE | E2E: file picker import flow, OPFS storage verification; Unit: OPFS service methods |
| FR2 | View books in library grid with covers | E83-S03 | P0 | NONE | E2E: grid renders with cards, cover images load; Unit: BookCard component |
| FR3 | Assign books to reading status shelves | E83-S04 | P1 | NONE | E2E: status change via context menu, filter by status; Unit: status update in store |
| FR4 | View and edit book metadata | E83-S05 | P2 | NONE | E2E: open editor, modify fields, verify persistence; Unit: metadata form validation |
| FR5 | Auto-fetch metadata/cover from Open Library API | E83-S02 | P1 | NONE | Unit: API response parsing, fallback on failure; E2E: cover appears after import |
| FR6 | Search and filter library by title, author, status, genre | E83-S04 | P1 | NONE | E2E: type in search, verify filter results; Unit: debounce logic, filter functions |
| FR7 | Delete books with OPFS cleanup | E83-S06 | P1 | NONE | E2E: delete flow, verify removal; Unit: OPFS cleanup, Dexie cascade deletion |

**E83 Data Model Foundation (E83-S01):** Not directly an FR but foundational. Needs unit tests for: Dexie v30 schema migration, `OpfsStorageService` methods (`storeBookFile`, `readBookFile`, `deleteBookFiles`, `getStorageEstimate`, `isOpfsAvailable`), IndexedDB fallback, `useBookStore` Zustand actions, route registration, sidebar progressive disclosure.

**E83 Storage Indicator (E83-S07):** Covers NFR8. Needs E2E: storage bar renders with correct thresholds; Unit: `getStorageEstimate()` formatting, color threshold logic.

### E84: EPUB Reader and Navigation (FR8-FR12)

| FR | Requirement | Story | Priority | Coverage | Planned Test Levels |
|----|-------------|-------|----------|----------|-------------------|
| FR8 | Open and read EPUB in paginated reader | E84-S01 | P0 | NONE | E2E: open book, verify epub.js renders, <500ms first page (NFR1); Unit: EpubRenderer component mounting |
| FR9 | Navigate pages and jump to chapters via TOC | E84-S02 | P0 | NONE | E2E: page turn (click/keyboard), TOC open/navigate, <100ms nav (NFR3); Unit: navigation event handling |
| FR10 | Customize reading appearance (font, theme) | E84-S03 | P1 | NONE | E2E: theme switch (light/sepia/dark), font size change, persistence; Unit: theme CSS application, contrast ratios (NFR13) |
| FR11 | Preserve reading position, resume on reopen | E84-S04 | P0 | NONE | E2E: read, close, reopen at same position; Unit: CFI save/restore debounce |
| FR12 | View reading progress as percentage | E84-S04 | P1 | NONE | E2E: progress bar updates on page turn, percentage shown; Unit: progress calculation |

### E85: Highlights, Flashcards, and Reading Sessions (FR13-FR25)

| FR | Requirement | Story | Priority | Coverage | Planned Test Levels |
|----|-------------|-------|----------|----------|-------------------|
| FR13 | Select text to create highlights | E85-S01 | P0 | NONE | E2E: text select triggers popover, highlight saved in <200ms (NFR2); Unit: CFI range extraction, Dexie write |
| FR14 | Assign colors to highlights | E85-S01 | P1 | NONE | E2E: tap color button, verify overlay color; Unit: color mapping |
| FR15 | Add text annotations to highlights | E85-S02 | P1 | NONE | E2E: note input appears, save annotation; Unit: annotation persistence |
| FR16 | View all highlights in consolidated view | E85-S03 | P1 | NONE | E2E: open highlight panel, verify list with cards; Unit: highlight query by bookId |
| FR17 | Delete or edit existing highlights | E85-S02 | P1 | NONE | E2E: edit color/note, delete highlight, verify removal; Unit: Dexie update/delete, flashcard link handling |
| FR18 | Store positions using CFI + text anchor | E85-S01 | P0 | NONE | Unit: text anchor generation (prefix/exact/suffix 30 chars), dual storage verification; E2E: highlight survives page reload |
| FR19 | Create flashcards from highlighted text | E85-S04 | P0 | NONE | E2E: flashcard button -> creator opens with text; Unit: flashcard record creation |
| FR20 | Create cloze-deletion flashcards (tap words to blank) | E85-S04 | P0 | NONE | E2E: tap words, verify [___] preview, create card; Unit: word tokenization, cloze text generation |
| FR21 | Flashcards linked to source book and highlight | E85-S04 | P1 | NONE | Unit: flashcard has sourceBookId and sourceHighlightId; E2E: verify link in review |
| FR22 | Flashcards enter FSRS review queue | E85-S04 | P0 | NONE | Unit: FSRS queue integration; E2E: flashcard appears in next review session |
| FR23 | Navigate from flashcard back to source highlight | E85-S05 | P2 | NONE | E2E: "View in Book" link navigates to reader at CFI; Unit: deleted book graceful fallback |
| FR24 | Track active reading time per session | E85-S06 | P1 | NONE | Unit: session start/end timestamps, duration calculation; E2E: session record created on reader close |
| FR25 | Reading sessions count toward study streak | E85-S06 | P0 | NONE | Unit: streak service processes reading:session-ended event; E2E: streak updates after reading |

### E86: Reading Statistics and Highlight Review (FR26-FR27, FR40-FR43)

| FR | Requirement | Story | Priority | Coverage | Planned Test Levels |
|----|-------------|-------|----------|----------|-------------------|
| FR26 | Reading time in Reports dashboard | E86-S01 | P1 | NONE | E2E: Reports page shows reading section with metrics; Unit: reading stats aggregation |
| FR27 | View reading statistics (time today, books in progress, pages/session) | E86-S01 | P1 | NONE | E2E: all stat widgets render with data; Unit: stat calculation functions |
| FR40 | Daily highlight review notifications | E86-S02 | P1 | NONE | Unit: notification creation logic (10+ highlights threshold); E2E: notification triggers, review screen opens |
| FR41 | Search across highlights (text + semantic) | E86-S03 | P1 | NONE | E2E: search returns book highlights alongside course content; Unit: vector index integration |
| FR42 | PKM export for book highlights (Obsidian/Readwise) | E86-S04 | P2 | NONE | Unit: Obsidian markdown format, Readwise CSV format; E2E: export file content validation |
| FR43 | Dismiss, review as flashcard, or add notes to surfaced highlights | E86-S02 | P1 | NONE | E2E: three actions on review card; Unit: action handlers |

### E87: Audiobook Player (FR28-FR35)

| FR | Requirement | Story | Priority | Coverage | Planned Test Levels |
|----|-------------|-------|----------|----------|-------------------|
| FR28 | Import audiobooks as MP3 folders | E87-S01 | P0 | NONE | E2E: select MP3 files, chapter order parsed, book created; Unit: filename parsing, OPFS storage |
| FR29 | Playback controls (play, pause, seek, skip) | E87-S02 | P0 | NONE | E2E: play/pause/seek/skip buttons functional; Unit: audio element integration |
| FR30 | Speed control 0.5x-3x without pitch distortion | E87-S03 | P1 | NONE | E2E: speed change applies, preservesPitch true; Unit: playbackRate setting |
| FR31 | Sleep timer with specified duration | E87-S03 | P2 | NONE | E2E: set timer, audio pauses when expired; Unit: timer countdown, fade-out logic |
| FR32 | Bookmarks at timestamps with optional notes | E87-S04 | P1 | NONE | E2E: create bookmark, view in list; Unit: AudioBookmark Dexie record |
| FR33 | Navigate between chapters | E87-S04 | P1 | NONE | E2E: tap chapter in list, audio switches; Unit: chapter load logic, cross-chapter skip |
| FR34 | Media Session API for OS controls | E87-S05 | P2 | NONE | Unit: Media Session handlers registered; E2E: difficult to test OS-level (unit preferred) |
| FR35 | Track audiobook sessions toward streak | E87-S06 | P1 | NONE | Unit: session record creation, streak event; E2E: streak updates after listening |

### E88: OPDS Catalogs and Advanced Sources (FR36-FR39)

| FR | Requirement | Story | Priority | Coverage | Planned Test Levels |
|----|-------------|-------|----------|----------|-------------------|
| FR36 | Connect to OPDS catalog by URL | E88-S01 | P1 | NONE | E2E: enter URL, validate OPDS feed, save connection; Unit: DOMParser XML validation, error handling |
| FR37 | Browse and import from OPDS catalogs | E88-S02 | P1 | NONE | E2E: browse grid, add book to library with remote source; Unit: OPDS entry parsing, pagination |
| FR38 | Stream EPUB from remote URL | E88-S03 | P1 | NONE | E2E: open remote book, reader loads; Unit: ArrayBuffer fetch, auth header injection, cache fallback |
| FR39 | Import M4B with chapter extraction | E88-S04 | P2 | NONE | E2E: import M4B, chapters appear; Unit: music-metadata parsing, chapter marker extraction |

---

## Phase 1: Coverage Statistics

| Metric | Value |
|--------|-------|
| Total Functional Requirements | 43 |
| Fully Covered | 0 (0%) |
| Partially Covered | 0 (0%) |
| Uncovered | 43 (100%) |

### Priority Breakdown

| Priority | Total | Covered | Percentage | Status |
|----------|-------|---------|------------|--------|
| P0 | 12 | 0 | 0% | NOT MET (required: 100%) |
| P1 | 22 | 0 | 0% | NOT MET (target: 90%) |
| P2 | 7 | 0 | 0% | NOT MET (target: 80%) |
| P3 | 2 | 0 | 0% | N/A |

### P0 Requirements (Must Have 100% Coverage)

| FR | Requirement | Epic | Story |
|----|-------------|------|-------|
| FR1 | EPUB file import | E83 | E83-S02 |
| FR2 | Library grid view with covers | E83 | E83-S03 |
| FR8 | EPUB paginated reader | E84 | E84-S01 |
| FR9 | Page/chapter navigation | E84 | E84-S02 |
| FR11 | Reading position persistence | E84 | E84-S04 |
| FR13 | Text selection to highlight | E85 | E85-S01 |
| FR18 | CFI + text anchor dual storage | E85 | E85-S01 |
| FR19 | Flashcard creation from highlights | E85 | E85-S04 |
| FR20 | Cloze-deletion flashcard creation | E85 | E85-S04 |
| FR22 | FSRS queue integration | E85 | E85-S04 |
| FR25 | Reading sessions count toward streak | E85 | E85-S06 |
| FR28 | MP3 folder audiobook import | E87 | E87-S01 |
| FR29 | Audiobook playback controls | E87 | E87-S02 |

> Note: 13 P0 requirements (not 12). FR29 is P0 as basic audiobook playback is a core capability for E87.

---

## Phase 1: Gap Analysis

### Critical Gaps (P0) -- 13 requirements

All 13 P0 requirements have zero test coverage. These **must** reach 100% coverage as each epic is implemented:

- **E83 (2 P0):** FR1 (import), FR2 (library view)
- **E84 (3 P0):** FR8 (reader), FR9 (navigation), FR11 (position persistence)
- **E85 (6 P0):** FR13 (highlight creation), FR18 (dual storage), FR19 (flashcard from highlight), FR20 (cloze deletion), FR22 (FSRS integration), FR25 (streak integration)
- **E87 (2 P0):** FR28 (MP3 import), FR29 (playback controls)

### High Gaps (P1) -- 22 requirements

All P1 requirements uncovered. Critical P1 items requiring early attention:

- **FR5** (Open Library API): Mock API responses needed for reliable E2E
- **FR36-FR37** (OPDS catalog): Requires OPDS feed fixtures for testing
- **FR40** (Daily highlight notifications): Integration with existing notification system from E58

### Coverage Heuristics Gaps

| Heuristic | Gap Count | Details |
|-----------|-----------|---------|
| Endpoints without tests | 3 | Open Library API (FR5), OPDS catalog feed (FR36-37), Remote EPUB streaming (FR38) |
| Auth negative-path gaps | 1 | OPDS basic auth (FR36 -- E88-S01): needs invalid credentials test |
| Happy-path-only criteria | 8 | FR1 (invalid EPUB), FR7 (OPFS delete failure), FR8 (corrupt EPUB), FR28 (invalid MP3s), FR29 (missing audio file), FR36 (unreachable server), FR38 (network timeout), FR39 (corrupt M4B) |

---

## Phase 1: Recommendations

| # | Priority | Action | Requirements |
|---|----------|--------|-------------|
| 1 | URGENT | Write E2E + Unit tests for all 13 P0 requirements as each epic is implemented via `/start-story` ATDD workflow | FR1, FR2, FR8, FR9, FR11, FR13, FR18, FR19, FR20, FR22, FR25, FR28, FR29 |
| 2 | HIGH | Create EPUB test fixtures (valid EPUB, corrupt EPUB, large EPUB, EPUB without cover) for E2E tests | FR1, FR8, FR9 |
| 3 | HIGH | Create OPDS feed XML fixtures and mock server for OPDS catalog testing | FR36, FR37, FR38 |
| 4 | HIGH | Add error-path tests for all 8 happy-path-only criteria (invalid files, network failures, storage full) | FR1, FR7, FR8, FR28, FR29, FR36, FR38, FR39 |
| 5 | HIGH | Mock Open Library API responses in E2E tests for deterministic metadata enrichment testing | FR5 |
| 6 | MEDIUM | Add negative auth tests for OPDS catalog connection (invalid credentials, expired auth) | FR36 |
| 7 | MEDIUM | Test OPFS fallback to IndexedDB in browsers without OPFS support (NFR23) | FR1, FR28 |
| 8 | LOW | Run `/bmad:tea:test-review` after each epic to assess test quality | All |

---

## FR-to-Story Complete Coverage Map

This table confirms that every FR maps to at least one implementing story:

| FR | Story(ies) | Epic | Verified |
|----|-----------|------|----------|
| FR1 | E83-S01, E83-S02 | E83 | Yes |
| FR2 | E83-S03 | E83 | Yes |
| FR3 | E83-S04 | E83 | Yes |
| FR4 | E83-S05 | E83 | Yes |
| FR5 | E83-S02 | E83 | Yes |
| FR6 | E83-S04 | E83 | Yes |
| FR7 | E83-S06 | E83 | Yes |
| FR8 | E84-S01 | E84 | Yes |
| FR9 | E84-S02 | E84 | Yes |
| FR10 | E84-S03 | E84 | Yes |
| FR11 | E84-S04 | E84 | Yes |
| FR12 | E84-S04 | E84 | Yes |
| FR13 | E85-S01 | E85 | Yes |
| FR14 | E85-S01 | E85 | Yes |
| FR15 | E85-S02 | E85 | Yes |
| FR16 | E85-S03 | E85 | Yes |
| FR17 | E85-S02 | E85 | Yes |
| FR18 | E85-S01 | E85 | Yes |
| FR19 | E85-S04 | E85 | Yes |
| FR20 | E85-S04 | E85 | Yes |
| FR21 | E85-S04 | E85 | Yes |
| FR22 | E85-S04 | E85 | Yes |
| FR23 | E85-S05 | E85 | Yes |
| FR24 | E85-S06 | E85 | Yes |
| FR25 | E85-S06 | E85 | Yes |
| FR26 | E86-S01 | E86 | Yes |
| FR27 | E86-S01 | E86 | Yes |
| FR28 | E87-S01 | E87 | Yes |
| FR29 | E87-S02 | E87 | Yes |
| FR30 | E87-S03 | E87 | Yes |
| FR31 | E87-S03 | E87 | Yes |
| FR32 | E87-S04 | E87 | Yes |
| FR33 | E87-S04 | E87 | Yes |
| FR34 | E87-S05 | E87 | Yes |
| FR35 | E87-S06 | E87 | Yes |
| FR36 | E88-S01 | E88 | Yes |
| FR37 | E88-S02 | E88 | Yes |
| FR38 | E88-S03 | E88 | Yes |
| FR39 | E88-S04 | E88 | Yes |
| FR40 | E86-S02 | E86 | Yes |
| FR41 | E86-S03 | E86 | Yes |
| FR42 | E86-S04 | E86 | Yes |
| FR43 | E86-S02 | E86 | Yes |

**Result: 43/43 FRs mapped to implementing stories. Zero orphaned requirements.**

---

## Story-to-FR Reverse Map

| Story | FRs Covered | NFRs Covered |
|-------|-------------|-------------|
| E83-S01 | (Foundation -- no direct FR) | NFR5, NFR7, NFR23 |
| E83-S02 | FR1, FR5 | NFR7, NFR8, NFR17, NFR20 |
| E83-S03 | FR2 | NFR6 |
| E83-S04 | FR3, FR6 | -- |
| E83-S05 | FR4 | -- |
| E83-S06 | FR7 | NFR11 |
| E83-S07 | (Storage indicator) | NFR8 |
| E84-S01 | FR8 | NFR1, NFR17, NFR20, NFR21 |
| E84-S02 | FR9 | NFR3, NFR12 |
| E84-S03 | FR10 | NFR13 |
| E84-S04 | FR11, FR12 | NFR10 |
| E85-S01 | FR13, FR14, FR18 | NFR2, NFR9, NFR15 |
| E85-S02 | FR15, FR17 | -- |
| E85-S03 | FR16 | -- |
| E85-S04 | FR19, FR20, FR21, FR22 | -- |
| E85-S05 | FR23 | -- |
| E85-S06 | FR24, FR25 | NFR10 |
| E86-S01 | FR26, FR27 | -- |
| E86-S02 | FR40, FR43 | -- |
| E86-S03 | FR41 | -- |
| E86-S04 | FR42 | -- |
| E87-S01 | FR28 | NFR18, NFR20 |
| E87-S02 | FR29 | NFR4 |
| E87-S03 | FR30, FR31 | NFR22 |
| E87-S04 | FR32, FR33 | -- |
| E87-S05 | FR34 | -- |
| E87-S06 | FR35 | NFR10 |
| E88-S01 | FR36 | -- |
| E88-S02 | FR37 | -- |
| E88-S03 | FR38 | -- |
| E88-S04 | FR39 | NFR18, NFR20 |

---

## Per-Epic Test Strategy Summary

### E83: Book Library and Import (7 stories)

- **E2E tests needed:** Import wizard flow, library grid/list rendering, search/filter, status management, book deletion, storage indicator
- **Unit tests needed:** OpfsStorageService (all 5 methods + fallback), useBookStore actions, Open Library API parsing, Dexie schema migration v30
- **Key risk:** OPFS availability detection + fallback path
- **Test fixtures:** Valid EPUB with metadata, EPUB without cover, EPUB with missing metadata

### E84: EPUB Reader and Navigation (4 stories)

- **E2E tests needed:** epub.js rendering, page turn (click/swipe/keyboard), TOC navigation, theme switching, font controls, position resume
- **Unit tests needed:** EpubRenderer mounting, CFI save/restore, progress calculation, theme CSS application
- **Key risk:** epub.js rendering timing (<500ms NFR1)
- **Test fixtures:** Multi-chapter EPUB with known content for position verification

### E85: Highlights, Flashcards, and Reading Sessions (6 stories)

- **E2E tests needed:** Text selection -> highlight popover, color selection, annotation, highlight list panel, cloze creator word-tap interaction, flashcard creation -> FSRS queue, back-navigation from flashcard to book, reading session tracking
- **Unit tests needed:** CFI range extraction, text anchor generation (prefix/exact/suffix), cloze text generation, word tokenization, flashcard source linking, session duration calculation, streak event emission
- **Key risk:** Highlight creation latency (<200ms NFR2), cloze word tokenization edge cases
- **Test fixtures:** EPUB with known paragraphs for highlight position testing

### E86: Reading Statistics and Highlight Review (4 stories)

- **E2E tests needed:** Reports dashboard reading section, daily highlight review card navigation, cross-highlight search, PKM export content
- **Unit tests needed:** Reading stats aggregation, notification scheduling (10+ highlights threshold), Obsidian/Readwise export format, vector search index integration
- **Key risk:** Integration with existing notification system (E58), vector search infrastructure

### E87: Audiobook Player (6 stories)

- **E2E tests needed:** MP3 folder import, audio playback controls, speed adjustment, sleep timer, chapter navigation, bookmark creation, mini-player persistence
- **Unit tests needed:** Filename chapter order parsing, audio playbackRate + preservesPitch, sleep timer countdown/fade, Media Session API handler registration, session tracking
- **Key risk:** Cross-chapter skip logic (skip past chapter end), Media Session API browser support
- **Test fixtures:** Short MP3 files (3-5 seconds each) for fast E2E tests

### E88: OPDS Catalogs and Advanced Sources (4 stories)

- **E2E tests needed:** OPDS URL entry + validation, catalog grid browsing, remote book addition, remote EPUB loading, M4B import
- **Unit tests needed:** DOMParser XML validation, OPDS Atom feed parsing, remote fetch with auth headers, music-metadata chapter extraction, cache fallback on network failure
- **Key risk:** OPDS feed format variations across servers, M4B chapter marker reliability
- **Test fixtures:** OPDS Atom XML feed fixtures, M4B file with chapter markers

---

## Phase 2: Gate Decision

### Current Status: PRE-IMPLEMENTATION BASELINE

| Gate Criteria | Required | Actual | Status |
|--------------|----------|--------|--------|
| P0 Coverage | 100% | 0% | NOT MET |
| P1 Coverage (PASS) | >= 90% | 0% | NOT MET |
| P1 Coverage (minimum) | >= 80% | 0% | NOT MET |
| Overall Coverage | >= 80% | 0% | NOT MET |

**Gate Decision: N/A (pre-implementation)**

This is a **planning-phase traceability matrix**. The gate will be evaluated incrementally:

- After **E83**: FR1-FR7 should reach P0: 100%, P1: 90%+
- After **E84**: FR8-FR12 added to coverage
- After **E85**: FR13-FR25 -- the largest single-epic coverage jump (13 FRs)
- After **E86**: FR26-27, FR40-43 complete
- After **E87**: FR28-FR35 complete
- After **E88**: All 43 FRs should be covered, gate should PASS

### Next Actions

1. **When starting E83:** Use `/start-story E83-S01` which will scaffold ATDD tests for each story
2. **After each epic:** Run `/testarch-trace` to regenerate this matrix with actual coverage
3. **Create test fixtures early:** EPUB files, MP3 files, OPDS XML feeds, M4B files -- store in `tests/fixtures/books/`
4. **Address error-path gaps:** Each story implementation should include error-path tests (not just happy path)

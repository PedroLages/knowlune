# Epic 87 (Audiobook Player) - Requirements-to-Tests Traceability Matrix

**Report Date**: April 5, 2026  
**Epic**: E87 - Audiobook Player  
**Status**: All 6 stories marked DONE  
**Scope**: 6 Stories (E87-S01 through E87-S06), 27 Acceptance Criteria total

---

## Executive Summary

**Coverage Assessment**: 0% (NO TEST SPECS FOUND)

- **Total Acceptance Criteria**: 27
- **Covered**: 0 (NOT COVERED)
- **Partial Coverage**: 0
- **Uncovered**: 27

**Quality Gate Recommendation**: **FAIL**

No dedicated E87 test specification files exist in `/tests/` directory. A comprehensive grep across all test files found zero references to audiobook components, hooks, or functionality (AudiobookRenderer, useAudioPlayer, AudioMiniPlayer, SpeedControl, SleepTimer, BookmarkButton, ChapterList, etc.).

---

## Story-by-Story Traceability

### E87-S01: Audiobook Import and Data Model (Dexie v38)

**Status**: DONE | **Test Coverage**: 0%

| AC# | Acceptance Criterion | Coverage | Test File | Risk |
|-----|----------------------|----------|-----------|------|
| AC1 | Dexie schema updated to v38; `audioBookmarks` table added with indexes on `bookId`, `chapterIndex`, `timestamp`, `createdAt` | NOT COVERED | None | HIGH |
| AC2 | Import dialog now accepts "Audiobook (MP3 folder)" as import type; user can select multiple MP3 files | NOT COVERED | None | HIGH |
| AC3 | Filenames parsed for chapter order (e.g., `01-introduction.mp3`); metadata extracted from first MP3 ID3 tags; all files stored at `/knowlune/books/{bookId}/chapter-{nn}.mp3`; Book record created with format='audiobook', chapters array, totalDuration | NOT COVERED | None | HIGH |
| AC4 | Book appears in Library with audiobook badge/indicator | NOT COVERED | None | HIGH |
| AC5 | `music-metadata` library (if used) does not cause Node.js module externalization warnings; production build succeeds | NOT COVERED | None | MEDIUM |

**Implementation Status**: ✓ IMPLEMENTED  
**Test Status**: ✗ NO TESTS

**Key Files Implemented**:
- src/db/checkpoint.ts (v38 migration)
- src/db/schema.ts (audioBookmarks table)
- src/app/components/library/AudiobookImportFlow.tsx
- src/app/components/library/BookImportDialog.tsx (extended)
- src/app/components/library/BookCard.tsx (audiobook badge)
- src/data/types.ts (AudioBookmark interface)

---

### E87-S02: Audiobook Player Controls and Playback

**Status**: DONE | **Test Coverage**: 0%

| AC# | Acceptance Criterion | Coverage | Test File | Risk |
|-----|----------------------|----------|-----------|------|
| AC1 | AudiobookRenderer displays (lazy-loaded) with: cover art, chapter title, progress scrubber, time labels, play/pause (size-16), skip back 15s/forward 30s buttons | NOT COVERED | None | HIGH |
| AC2 | HTML5 `<audio>` element plays current chapter MP3; progress scrubber updates in real-time; user can drag scrubber to seek; seek <200ms (NFR4) | NOT COVERED | None | HIGH |
| AC3 | Skip forward 30s/back 15s updates position; if skipping past chapter end, next chapter loads; if skipping before chapter start, previous chapter loads from appropriate position | NOT COVERED | None | HIGH |
| AC4 | Playback paused >30s: resume rewinds 5s (Smart Resume), clamped to chapter start; "Rewound 5s" toast appears for 2s | NOT COVERED | None | MEDIUM |

**Implementation Status**: ✓ IMPLEMENTED  
**Test Status**: ✗ NO TESTS

**Key Files Implemented**:
- src/app/components/audiobook/AudiobookRenderer.tsx
- src/app/hooks/useAudioPlayer.ts
- src/stores/useAudioPlayerStore.ts
- src/app/pages/BookReader.tsx (audiobook routing)

---

### E87-S03: Speed Control and Sleep Timer

**Status**: DONE | **Test Coverage**: 0%

| AC# | Acceptance Criterion | Coverage | Test File | Risk |
|-----|----------------------|----------|-----------|------|
| AC1 | Speed popover with 9 options (0.5x–3.0x); active speed checkmarked + `text-brand font-medium`; selecting speed sets `audio.playbackRate`, `audio.preservesPitch = true`; persists in store | NOT COVERED | None | HIGH |
| AC2 | Sleep timer popover with options: 15/30/45/60 min, End of chapter, Off; badge shows remaining time when active; on expiry, audio fades out 5s and pauses; "End of chapter" pauses at file end; on next app open, toast shows "Sleep timer ended" | NOT COVERED | None | HIGH |

**Implementation Status**: ✓ IMPLEMENTED  
**Test Status**: ✗ NO TESTS

**Key Files Implemented**:
- src/app/components/audiobook/SpeedControl.tsx
- src/app/components/audiobook/SleepTimer.tsx
- src/app/hooks/useSleepTimer.ts

---

### E87-S04: Chapter Navigation and Bookmarks

**Status**: DONE | **Test Coverage**: 0%

| AC# | Acceptance Criterion | Coverage | Test File | Risk |
|-----|----------------------|----------|-----------|------|
| AC1 | Chapter list shows: completed chapters with Check icon (text-success), current chapter with Play icon (text-brand, font-medium), upcoming with default text; rows show title, duration, separator; tapping chapter loads and plays that chapter's MP3 | NOT COVERED | None | HIGH |
| AC2 | Bookmark button creates `AudioBookmark` record in Dexie at current timestamp; optional note input slides down; toast confirms "Bookmark saved at {time}"; bookmarks viewable in header menu "Bookmarks" | NOT COVERED | None | HIGH |

**Implementation Status**: ✓ IMPLEMENTED  
**Test Status**: ✗ NO TESTS

**Key Files Implemented**:
- src/app/components/audiobook/ChapterList.tsx
- src/app/components/audiobook/BookmarkButton.tsx
- src/app/components/audiobook/BookmarkListPanel.tsx

---

### E87-S05: Mini-Player and Media Session Integration

**Status**: DONE | **Test Coverage**: 0%

| AC# | Acceptance Criterion | Coverage | Test File | Risk |
|-----|----------------------|----------|-----------|------|
| AC1 | Mini-player bar appears fixed at bottom when audiobook playing + navigated away from player page; shows: cover thumbnail, title/chapter, play/pause, skip buttons, speed, expand button, thin progress bar; mobile shows play/pause only; expand returns to full player | NOT COVERED | None | HIGH |
| AC2 | Media Session API configured with: title, artist, album, artwork, and action handlers (play, pause, previoustrack, nexttrack, seekbackward, seekforward); user can control from OS lock screen, notification center, Bluetooth headset | NOT COVERED | None | MEDIUM |

**Implementation Status**: ✓ IMPLEMENTED  
**Test Status**: ✗ NO TESTS

**Key Files Implemented**:
- src/app/components/audiobook/AudioMiniPlayer.tsx
- src/app/hooks/useMediaSession.ts
- src/app/components/Layout.tsx (mini-player integration)
- src/app/hooks/useAudioPlayer.ts (singleton audio element)

---

### E87-S06: Audiobook Session Tracking and Streak

**Status**: DONE | **Test Coverage**: 0%

| AC# | Acceptance Criterion | Coverage | Test File | Risk |
|-----|----------------------|----------|-----------|------|
| AC1 | Listening session starts when user plays audiobook; recorded with timestamp | NOT COVERED | None | HIGH |
| AC2 | On pause/close/navigate: `studySession` record created with contentType='audiobook', bookId, start/end timestamps, listening duration; streak service processes session; listening time appears in Reports | NOT COVERED | None | HIGH |

**Implementation Status**: ✓ IMPLEMENTED  
**Test Status**: ✗ NO TESTS

**Key Files Implemented**:
- src/app/hooks/useAudioListeningSession.ts
- src/lib/eventBus.ts (listening:session-ended event)
- src/lib/studyLog.ts (book_listened StudyAction type)
- src/services/ReadingStatsService.ts (clarified comment for audiobook support)

---

## Non-Functional Requirements Coverage

| NFR | Requirement | Coverage | Notes |
|-----|-------------|----------|-------|
| NFR4 | Seek operations < 200ms | NOT COVERED | Seek timeout specified in AC2 (E87-S02) — no performance test |
| NFR14 | Controls accessible via keyboard & screen reader | NOT COVERED | No accessibility tests |
| NFR18 | Audiobook code < 200KB gzipped | NOT COVERED | No bundle size tests |
| NFR20 | Lazy-loaded (not in initial bundle) | NOT COVERED | No build/bundle verification tests |
| NFR22 | `preservesPitch` browser compatibility (Chrome 86+, Firefox 101+, Safari 15.4+) | NOT COVERED | No cross-browser tests |

---

## Risk Assessment by Category

### HIGH-RISK UNCOVERED FEATURES (15)

1. **Audiobook Import** (E87-S01: AC1-AC4)
   - Dexie v38 schema migration not tested
   - Import dialog MP3 selection not tested
   - Metadata extraction from ID3 tags not tested
   - Library badge display not tested
   - **Impact**: Core data integrity at risk; schema migration could corrupt existing data

2. **Playback Mechanics** (E87-S02: AC1-AC3)
   - AudiobookRenderer component rendering not tested
   - Seek operations and cross-chapter logic not tested
   - HTML5 audio element integration not tested
   - **Impact**: Core playback UX non-functional without tests; regression risk on audio API changes

3. **Speed Control** (E87-S03: AC1)
   - Playback rate persistence not tested
   - `preservesPitch` flag setting not tested
   - Speed option rendering not tested
   - **Impact**: User speed preference may not persist; pitch distortion on speed changes unpredictable

4. **Sleep Timer** (E87-S03: AC2)
   - Timer countdown logic not tested
   - Fade-out animation not tested
   - "End of chapter" mode not tested
   - Post-sleep notification not tested
   - **Impact**: Timer may not trigger correctly; audio may not fade properly

5. **Chapter Navigation & Bookmarks** (E87-S04: AC1-AC2)
   - ChapterList rendering not tested
   - Chapter switching logic not tested
   - Bookmark creation and persistence not tested
   - **Impact**: Users cannot navigate between chapters; bookmarks data loss risk

6. **Mini-Player** (E87-S05: AC1)
   - Mini-player visibility logic not tested
   - Fixed bottom bar layout not tested
   - Playback state across routes not tested
   - **Impact**: Mini-player may not appear on non-player pages; playback interrupted on navigation

7. **Session Tracking & Streak** (E87-S06: AC1-AC2)
   - Session start/stop recording not tested
   - studySession record creation not tested
   - Streak integration not tested
   - Reports aggregation not tested
   - **Impact**: Learning time not counted toward streak; Reports statistics inaccurate

### MEDIUM-RISK UNCOVERED FEATURES (3)

1. **Smart Resume** (E87-S02: AC4) — User experience degradation if 5s rewind triggers unexpectedly
2. **Media Session API** (E87-S05: AC2) — OS-level controls may not work; graceful degradation only if error handling exists
3. **Build Integrity** (E87-S01: AC5) — Production build may fail with unresolved module warnings

### LOW-RISK ITEMS (0)

---

## Test Coverage Gap Analysis

### By Implementation Layer

| Layer | Component | Status | Test Gap |
|-------|-----------|--------|----------|
| **Data Model** | AudioBookmark type, Dexie schema v38 | ✓ Implemented | ✗ No schema migration test |
| **Storage** | OPFS audio file storage, OpfsStorageService | ✓ Reused from E83 | ? Depends on E83 coverage (not verified) |
| **Hooks** | useAudioPlayer, useAudioPlayerStore, useSleepTimer, useMediaSession, useAudioListeningSession | ✓ Implemented | ✗ Zero unit/integration tests |
| **Components** | AudiobookRenderer, SpeedControl, SleepTimer, ChapterList, BookmarkButton, BookmarkListPanel, AudioMiniPlayer | ✓ Implemented | ✗ Zero component tests |
| **Integration** | BookReader page audiobook routing, Layout mini-player, event bus emission, streak service | ✓ Implemented | ✗ No E2E coverage |
| **E2E** | Full user flows: import → play → control → bookmark → track | ✓ Code ready | ✗ No test specs |

### By Test Type Needed

| Test Type | Count | Notes |
|-----------|-------|-------|
| Unit Tests (hooks, utilities) | 8 | None exist |
| Component Tests (React rendering) | 7 | None exist |
| Integration Tests (store + components) | 5 | None exist |
| E2E Tests (user flows) | 6+ | None exist (one per story) |
| Performance Tests (seek <200ms, bundle size) | 2 | None exist |
| Accessibility Tests (keyboard, screen reader) | 1 | None exist |
| **TOTAL TESTS NEEDED** | **~29** | **ALL MISSING** |

---

## Quality Gate Decision

### FAIL

**Rationale**:

1. **Zero Test Coverage** (0%)
   - No unit tests for hooks/utilities
   - No component tests for rendering/interaction
   - No integration tests for state management
   - No E2E tests for user flows
   - No test specs in `/tests/` directory at all

2. **High-Risk Gaps**
   - Core data integrity (Dexie v38 migration untested)
   - Core playback mechanics (seek, skip, chapter switching untested)
   - Critical user features (bookmarks, session tracking untested)
   - No regression protection

3. **No Mitigations**
   - All 6 stories marked DONE but no corresponding test files
   - Story completion notes defer tests ("Task 7 deferred — requires File API mocking")
   - No documented rationale for deferring all test coverage

4. **Burn-in Status**
   - `burn_in_validated: false` for all 6 stories
   - No manual QA evidence in story files
   - No test result documentation

### Why This Fails Quality Gates

- **PASS threshold** (>80%): 0% coverage
- **CONCERNS threshold** (50-80%): 0% coverage
- **WAIVED threshold** (documented rationale): No documented justification

---

## Remediation Roadmap

### Immediate (Pre-Release)

1. **Create E2E Test Specs** (1 per story)
   - File pattern: `tests/e2e/story-e87-s{N}.spec.ts`
   - Follow existing story test patterns from E83-S04 through S07
   - Use study session helpers from `tests/support/helpers/study-session-test-helpers.ts` as template

2. **Critical Path Tests** (highest risk first)
   - E87-S01: Dexie v38 migration + import flow
   - E87-S02: Playback + seek + cross-chapter skip
   - E87-S06: Session creation + streak integration

3. **Test Infrastructure**
   - MP3 file fixtures (small test audio files)
   - AudioBook factory (`tests/support/fixtures/factories/audiobook-factory.ts`)
   - Mock data helpers for Dexie audioBookmarks table

### Short-term (Next Sprint)

4. **Unit/Integration Tests**
   - useAudioPlayer hook (play/pause/seek state machine)
   - useSleepTimer (countdown + fade logic)
   - useAudioListeningSession (30s threshold, beforeunload)

5. **Component Tests**
   - SpeedControl (9 speed options, persistence)
   - ChapterList (status icons, chapter switching)
   - AudioMiniPlayer (visibility, responsive layout)

### Medium-term

6. **Performance & NFR Tests**
   - Seek <200ms verification
   - Bundle size verification (audiobook code <200KB gzipped)
   - Cross-browser Media Session API

---

## Acceptance Criteria Summary Table

### Legend
- **COVERED**: Test file exists + test case found
- **PARTIAL**: Some related tests exist but not comprehensive
- **NOT COVERED**: No test found
- **HIGH**: Core feature; data/UX impact; regression risk
- **MEDIUM**: Feature enhancement; graceful degradation exists
- **LOW**: Minor feature; workaround available

### Counts by Story

| Story | ACs | Covered | Partial | Not Covered | % Coverage | Pass/Fail |
|-------|-----|---------|---------|-------------|------------|-----------|
| E87-S01 | 5 | 0 | 0 | 5 | 0% | FAIL |
| E87-S02 | 4 | 0 | 0 | 4 | 0% | FAIL |
| E87-S03 | 2 | 0 | 0 | 2 | 0% | FAIL |
| E87-S04 | 2 | 0 | 0 | 2 | 0% | FAIL |
| E87-S05 | 2 | 0 | 0 | 2 | 0% | FAIL |
| E87-S06 | 2 | 0 | 0 | 2 | 0% | FAIL |
| **TOTAL** | **27** | **0** | **0** | **27** | **0%** | **FAIL** |

---

## References

**Story Files**:
- /Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E87-S01.md
- /Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E87-S02.md
- /Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E87-S03.md
- /Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E87-S04.md
- /Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E87-S05.md
- /Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E87-S06.md

**Implemented Components**:
- /Volumes/SSD/Dev/Apps/Knowlune/src/app/components/audiobook/
- /Volumes/SSD/Dev/Apps/Knowlune/src/app/hooks/
- /Volumes/SSD/Dev/Apps/Knowlune/src/stores/

**Test Directory**:
- /Volumes/SSD/Dev/Apps/Knowlune/tests/ (no E87 specs found)

**Test Helpers**:
- /Volumes/SSD/Dev/Apps/Knowlune/tests/support/helpers/study-session-test-helpers.ts
- /Volumes/SSD/Dev/Apps/Knowlune/tests/support/fixtures/factories/

---

**Report Generated**: 2026-04-05  
**Report Status**: FINAL - Ready for stakeholder review

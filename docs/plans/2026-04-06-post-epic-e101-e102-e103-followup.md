# Post-Epic E101/E102/E103 Follow-Up Plan

**Created:** 2026-04-06  
**Context:** All 13 stories across E101, E102, E103 shipped. This plan covers all follow-up work: chore fixes, documentation, known-issues triage, new story for Link Formats UI, and test debt.

---

## Quick Reference: BMad Commands

| Task | Command |
|------|---------|
| Create a new epic + its stories (use this for new work) | `/bmad-create-epics-and-stories` |
| Add a story to an existing open epic | `/bmad-create-story` |
| Execute a story | `/start-story E##-S##` |
| Run post-story review | `/review-story E##-S##` |

**Rule of thumb:** If the story needs a new epic home, always use `/bmad-create-epics-and-stories`. `/bmad-create-story` alone creates an orphan — the story has no epic registered in `sprint-status.yaml`.

**Next available epic IDs:** E104, E105 (E103 is the last done; E92-E99 are backlog covering different scope)

---

## Phase 1: Quick Chore Commit (No Story, No Review Loop)

Four small code fixes that are too small for a story but should not stay open. Commit directly as `chore:`.

### Fix 1 — `normalizeChapterTitle` regex edge case
**File:** `src/lib/chapterMatcher.ts`  
**Issue:** Regex doesn't handle Unicode typographic hyphens (e.g. `–`, `—`). Chapters with em-dashes don't normalize correctly.  
**Fix:** Extend the strip-punctuation regex to include `\u2013` and `\u2014`.

### Fix 2 — `isSocketConnected` non-reactive in `useAudiobookshelfSocket`
**File:** `src/app/hooks/useAudiobookshelfSocket.ts`  
**Issue:** `isSocketConnected` flag is read via `getState()` in the WebSocket `onmessage` handler — non-reactive, returns stale value if Dexie hydration hasn't completed.  
**Fix:** Replace `getState().isSocketConnected` with a reactive selector or pass the current value via a ref.

### Fix 3 — `seriesLoaded` / `collectionsLoaded` not keyed by serverId
**File:** `src/stores/useAudiobookshelfStore.ts`  
**Issue:** Both flags are global booleans. If the user switches the active ABS server, stale series/collections data from the previous server is shown until a manual refresh.  
**Fix:** Convert to `Record<serverId, boolean>` keyed by server ID. Already noted in E102 architectural debt.  
**Reference:** E102 completion report Section 4 "Architectural Debt".

### Fix 4 — `fetchCollections` only fetches page 1
**File:** `src/services/AudiobookshelfService.ts`  
**Issue:** `fetchCollections()` does not paginate — only fetches the first page. Large libraries will show an incomplete collections list.  
**Fix:** Add the same pagination loop used by `fetchSeriesForLibrary()`.

### How to commit
```bash
git add src/lib/chapterMatcher.ts src/app/hooks/useAudiobookshelfSocket.ts \
        src/stores/useAudiobookshelfStore.ts src/services/AudiobookshelfService.ts
git commit -m "chore(abs): fix regex edge case, reactive socket flag, server-keyed cache, collections pagination"
```

---

## Phase 2: Retrospective Action Items (Documentation Chores)

These are documentation and tooling updates from E101/E102/E103 retros. All are chore commits — no stories, no review loop.

### E101 Retro Actions (from `epic-101-retro-2026-04-06.md`)

| # | Action | File | Priority |
|---|--------|------|----------|
| R1 | Document `addInitScript` window.fetch override as the canonical pattern for cross-origin E2E mocking. Include WHY page.route() fails (Chromium same-origin policy for dynamic user-supplied URLs), HOW (addInitScript before navigate), and cleanup pattern (restore in afterEach) | `.claude/rules/testing/test-patterns.md` | HIGH |
| R2 | Document detached Audio element cleanup: `useEffect` cleanup must call `audio.removeEventListener(...)` for all events attached in the effect body. Without this: act() warnings, state-into-unmounted-component errors | `.claude/rules/testing/test-cleanup.md` | HIGH |
| R3 | Add Dexie method selection: `add()` for new records (throws on duplicate — surfaces UUID bugs), `put()` for explicit upserts (sync scenarios only), `update()` for partial updates | `docs/engineering-patterns.md` | MEDIUM |
| R4 | Add to Pre-Review Checklist: "At every non-obvious code site (AbortController, timer cleanup, catch blocks), add `// Intentional: <reason>` comment" | `docs/implementation-artifacts/story-template.md` | MEDIUM |
| R5 | Check if "Challenges and Lessons Learned must be completed before review" gate already exists in `/review-story`. Add if absent | `.claude/skills/review-story/SKILL.md` | MEDIUM |
| R6 | Add stale-closure check to Pre-Review Checklist: "For every `useEffect` or async callback that reads Zustand state: confirm it reads from `get()` inside the callback, not from outer render scope" | `docs/implementation-artifacts/story-template.md` | MEDIUM |

### E102 Retro Actions

| # | Action | File | Priority |
|---|--------|------|----------|
| C9 | Add Engine.IO framing comment block explaining the protocol (`42["event",{...}]` format, ping/pong, packet type prefixes) | `src/services/AudiobookshelfService.ts` | LOW |
| C6 | Document `ws:/wss:` CSP wildcard as intentional for ABS self-hosted LAN use | `docs/engineering-patterns.md` | LOW |

### E103 Retro Action

| # | Action | File | Priority |
|---|--------|------|----------|
| - | Document position-save-before-navigate: before any reader→reader navigation, flush current position to IndexedDB | `docs/engineering-patterns.md` | MEDIUM |
| - | Audit `unshelfBook()` and `archiveBook()` — verify atomic Dexie transactions for multi-record writes | `src/stores/useBookStore.ts` | MEDIUM |

---

## Phase 3: Known Issues Triage

Current open issues from `docs/known-issues.yaml`:

### Group A: Quick Code/Lint Fixes (Chore Commits, No Story)

| ID | Summary | Severity | Action |
|----|---------|----------|--------|
| KI-028 | 8 console errors from EmbeddingWorker model fetch failures on page load | MEDIUM | Add offline guard in EmbeddingWorker.ts; suppress noise in E2E |
| KI-030 | 5 ESLint errors in non-story files (parsing, missing rule, require-yield) | MEDIUM | Fix each error inline; most are in server/ files |
| KI-033 | 110+ ESLint warnings (component size, hard waits, silent catches, unused vars) | LOW | Incremental pass: fix unused vars and obvious ones; skip component-size warnings (architectural) |
| KI-035 | CatalogListView browse/edit/delete buttons 36px, below 44px WCAG minimum | LOW | Change `size-9` → `size-11` on the 3 icon buttons in CatalogListView.tsx:73,84,93 |

Commit these together: `chore(lint+a11y): fix eslint errors, embedding worker noise, touch targets`

### Group B: Deferred to E19 (No Action Needed Now)

| ID | Summary | Why Deferred |
|----|---------|-------------|
| KI-034 | OPDS credentials stored in plaintext IndexedDB | Acceptable for local-first. Scheduled for E19 (Supabase sync encryption). Already has `scheduled_for: E19` |

### Group C: ABS-Specific Adversarial Findings (From E101 Completion Report Section 4)

These were proposed as "skip" but the user wants them addressed:

| ID | Finding | Severity | Recommended Action |
|----|---------|----------|-------------------|
| A2 | `connection.spec.ts` never created — no E2E for server add/remove/CORS onboarding flow | HIGH | Create `tests/e2e/audiobookshelf/connection.spec.ts` as a chore commit (3-4 tests: add server, remove server, CORS error, reconnect) |
| A3 | Podcast library items silently mapped as Book records | HIGH | Add `mediaType === 'book'` guard in `useAudiobookshelfSync.ts` before upsert; add unit test | 
| A5 | No ABS version compatibility gate | MEDIUM | Add version check in `testConnection()` response handler; warn if `< v2.26.0` |
| A6 | `PostSessionBookmarkReview` fires on any `isPlaying → false` (buffer stall, accidental pause) | MEDIUM | Fix: only fire on `deliberateStopRef.current === true`; already has the ref from E101-S05 |

These 4 can be done as a single chore commit: `chore(abs): connection spec, podcast filter, version gate, bookmark review trigger`

### Group D: Test Debt (See Phase 4)

| IDs | Type |
|-----|------|
| KI-016 through KI-025 | Failing unit/E2E tests — see Phase 4 |
| KI-029 | Unit coverage 63.67% below 70% threshold — see Phase 4 |

---

## Phase 4: Test Debt

These are failing tests pre-existing before E101 (discovered in 2026-03-26 audit). They have been deferred across multiple epics. Time to address them.

### Failing Tests Inventory

| ID | File | Failing | Root Cause (suspected) |
|----|------|---------|----------------------|
| KI-016 | `ImportWizardDialog.test.tsx` | 28 unit | Component refactored, tests not updated |
| KI-017 | `Courses.test.tsx` | 11 unit | Mock updates needed after store changes |
| KI-018 | `useFlashcardStore.test.ts` | 2 unit | Stale IDB mock setup |
| KI-019 | `useReviewStore.test.ts` | 4 unit | Stale mock setup |
| KI-020 | `useSessionStore.test.ts` | 3 unit | Stale mock setup |
| KI-021 | `courses.spec.ts` | 2 E2E | Courses page rendering issue |
| KI-022 | `navigation.spec.ts` | 2 E2E | Cascades from KI-021 |
| KI-023 | `dashboard-reordering.spec.ts` | 4 E2E | Timing/localStorage seeding |
| KI-024 | `accessibility-courses.spec.ts` | 1 E2E | Cascades from KI-021 |
| KI-025 | `nfr35-export.spec.ts` | 1 E2E | UI button moved/renamed |
| KI-029 | `vitest.config.ts` | — | Coverage 63.67% < 70% threshold |

**Total:** 58 failing tests + coverage gap.

### Recommended Approach

Create a single story: **"Test Debt Cleanup — KI-016 through KI-025 & KI-029"**

Use: `/bmad-create-story`

Story scope:
1. Fix all unit test failures (KI-016 through KI-020) — update mocks to match current store/component shape
2. Fix E2E test failures starting with root cause (KI-021 Courses page) which cascades KI-022, KI-024
3. Fix KI-023 dashboard reordering (timing/seeding issue, not Courses-related)
4. Fix KI-025 export button E2E
5. Address KI-029 coverage threshold: either lower threshold to match current reality (63%) or add 20+ tests to lift coverage above 70%

Acceptance criteria: `npm run test:unit` and `npm run test:e2e` both pass with zero failures.

### E102 High-Priority Test Chores

These are from E102's open chore list — not in known-issues.yaml but deferred from review:

| ID | Description | Priority | Where to add |
|----|-------------|----------|-------------|
| C1 | Add 3 unit tests for `resolveConflict()`: ABS ahead, local ahead, equal timestamps | HIGH | `src/stores/__tests__/useAudiobookshelfStore-sync.test.ts` |
| C2 | Extend E2E for E102-S01-AC4: assert `PATCH /api/me/progress/:itemId` is called when local is ahead | MEDIUM | `tests/e2e/audiobookshelf/sync.spec.ts` |
| C3 | Add E2E assertion: REST polling resumes after socket disconnect (E102-S04-AC4) | MEDIUM | `tests/e2e/audiobookshelf/socket-sync.spec.ts` |
| C4 | Run burn-in (10 iterations) for `socket-sync.spec.ts` — timing-sensitive `addInitScript` WebSocket injection | MEDIUM | Script: `scripts/burn-in.sh tests/e2e/audiobookshelf/socket-sync.spec.ts 10` |

C1-C3 can be chore commits. C4 is just a validation run (no code change expected unless flakiness found).

---

## Phase 5: New Story — "Link Formats" UI

**Priority: HIGH** — Without this, the entire E103 Whispersync feature is unreachable.

From E103 completion report:
> There is no UI to create a book link (`linkBooks`). Without a linked pair, the "Switch to Reading/Listening" button never renders. The chapter mapping computed by E103-S01 is never triggered automatically.
> **Recommended action:** Add a minimal "Link formats" UI story (estimated 0.5 sprint) before Whispersync is promoted in any release notes.

### BMad Command

```
/bmad-create-story
```

When prompted, provide this story brief:

**Story Title:** Link Formats UI — Book Pairing Entry Point for Whispersync

**Context:**  
Epic 103 (Whispersync) shipped a full chapter-matching engine (`chapterMatcher.ts`), format-switching controls (`FormatSwitchButton`), and dual position tracking (`chapterSwitchResolver.ts`). However, none of this is reachable because:
1. `linkBooks(bookId, linkedBookId)` in `useBookStore.ts` has no UI entry point
2. `computeChapterMapping()` in `chapterMatcher.ts` is never called automatically
3. `ChapterMappingEditor.tsx` (E103-S01) exists but is not mounted anywhere

**Goal:**  
Add a "Link Formats" button or panel to the book library view (BookCard / BookListItem context menu, or a detail page) that allows the user to:
1. Select an EPUB and an audiobook to pair as linked formats
2. Trigger `computeChapterMapping()` to auto-match chapters
3. Show `ChapterMappingEditor` for any manual corrections
4. Call `linkBooks()` to persist the pairing in Dexie

**Acceptance Criteria (draft):**
- AC1: From any book's context menu / detail view, the user can tap "Link Format" to open the pairing dialog
- AC2: The dialog shows unlinked EPUBs and unlinked audiobooks as selectable targets
- AC3: On pairing, `computeChapterMapping()` runs and shows a confidence score
- AC4: Low-confidence mappings open `ChapterMappingEditor` for manual review before saving
- AC5: High-confidence mappings (>0.85) auto-save after a confirmation step
- AC6: Once linked, both books show "Also available as [Audiobook/EPUB]" badge (already implemented in E103-S03)
- AC7: Unlinking is possible from the same dialog

**Files to extend:**
- `src/app/components/library/BookCard.tsx` — add "Link Format" option to context menu
- `src/app/components/library/BookListItem.tsx` — same
- `src/app/components/library/LinkFormatsDialog.tsx` — new dialog component
- `src/stores/useBookStore.ts` — `linkBooks()` already exists (atomic transaction from E103-S03)
- `src/lib/chapterMatcher.ts` — `computeChapterMapping()` already exists
- `src/app/components/library/ChapterMappingEditor.tsx` — already exists (E103-S01)

---

## Execution Order for New Session

Run in this order (each phase unblocks the next):

```
1. Phase 1: Quick chore commit (4 code fixes)           [~30 min, no review]
2. Phase 2: Retro docs chore commit (R1-R6, E103)      [~45 min, no review]
3. Phase 3 Group A: Code/lint fixes chore commit       [~20 min, no review]
3. Phase 3 Group C: ABS adversarial chore commit        [~45 min, no review]
4. Phase 4 C1-C3: E102 test chores                     [~30 min, no review]
5. Phase 4 C4: Burn-in run for socket-sync.spec.ts     [~15 min, validation only]
5. Phase 5: /bmad-create-story "Link Formats" UI       [creates story artifact]
6. Phase 4 story: /bmad-create-story "Test Debt"       [creates story artifact]
7. Run created stories with /start-story + /review-story + /finish-story
```

After Phase 1-4 chore commits are done, the two new stories can be run with `/epic-orchestrator` or manually via `/start-story`.

---

## Summary Table

| Phase | Type | BMad Command | Est. Scope |
|-------|------|-------------|-----------|
| 1: Quick fixes | Chore commit | None | 4 files |
| 2: Retro docs | Chore commit | None | 5 files |
| 3A: Code/lint fixes | Chore commit | None | 4-6 files |
| 3C: ABS adversarial | Chore commit | None | 4-5 files |
| 4: E102 test chores | Chore commit + burn-in | None | 2 test files |
| 5: Link Formats UI | Story | `/bmad-create-story` | ~7 files, 0.5 sprint |
| 6: Test Debt | Story | `/bmad-create-story` | ~11 test files, 1 sprint |

Total chore commits: ~5  
New stories to create: 2  
New stories to execute: 2 (after artifacts created)

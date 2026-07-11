---
title: "fix: Resolve all pre-existing errors across the app in 4 phases"
type: fix
status: active
date: 2026-07-11
deepened: 2026-07-11
---

# fix: Resolve All Pre-existing Errors Across the App

## Overview

This plan addresses all verified pre-existing errors in the Knowlune application — TypeScript compilation errors, ESLint errors, silent catch blocks, MEDIUM-severity known issues, and low-severity polish items. The work is organized into 4 phases ordered by dependency: TypeScript errors first (they block CI), then ESLint errors, then MEDIUM reliability gaps and silent catches, and finally LOW polish.

**Re-baselined 2026-07-11:** The original plan was written against stale `known-issues.yaml` data. Five HIGH-severity bugs (KI-101–KI-105) were already fixed in commit `91d29166`. The `syncableWrite<T>` generic, `truncated` flag, `cursorField` ordering, and several ImportWizardDialog guards are also already in place. This revision reflects actual codebase state verified via `npx tsc --noEmit`, `grep`, and file reads.

## Problem Frame

The Knowlune codebase has accumulated errors across multiple epics. The current verified state:

- **32 TypeScript errors** across 13 files — blocks `tsc --noEmit` and fails CI
- **17 ESLint errors** in `scripts/verify-dist.cjs` — `.cjs` extension not matched by Node globals config, plus `no-require-imports` violations
- **485 ESLint warnings** — component size, silent catches, inline styles, `any` types
- **3 HIGH severity known issues remaining** (KI-106–KI-108) — missing test coverage for critical paths (the 5 production bugs KI-101–KI-105 were already fixed)
- **~15 MEDIUM severity known issues** — reliability gaps, test coverage gaps, data integrity (some KI-109–KI-127 items verified already fixed)
- **~40 LOW/NIT severity known issues** — accessibility, component polish, naming consistency
- **~91 files with silent catch patterns** (`.catch(() => {})`) that swallow errors with zero diagnostic output

## Requirements Trace

- **R1.** `npm run typecheck` passes with zero errors
- **R2.** `npm run lint` passes with zero errors (warnings acceptable at current levels)
- **R3.** Remaining HIGH severity known issues (KI-106–KI-108) are resolved
- **R4.** All verified MEDIUM severity source-code known issues are resolved (excluding Supabase SQL migration nits)
- **R5.** Silent catch blocks in production code have at minimum `console.error` logging, prioritized by user impact
- **R6.** No existing functionality is broken — all existing tests continue to pass
- **R7.** LOW severity fixes are applied where they are low-effort and high-impact
- **R8.** `docs/known-issues.yaml` is updated to reflect resolved issues discovered during implementation

## Scope Boundaries

- Supabase SQL migration nits (KI-069–KI-080) are **excluded** — database-level concerns requiring migration files
- `src/premium/` directory is **excluded** — intentionally excluded from tsconfig, proprietary code
- Component-size warnings (37 components >500 lines) are **excluded** — architectural refactoring, not error fixing
- `audiobook-m4b` skill issues are **excluded** — external skill, not app code
- New features or enhancements are **excluded** — this is strictly error/bug fixing
- Scheduled/planned issues (KI-034 E19, KI-061 E68, KI-065/KI-066 E70) are **excluded** — they have dedicated epics
- Already-fixed issues (KI-101–KI-105, KI-116, KI-118, KI-126, `supabase-cloud-sync-updated-at`) are **excluded** — verified in current code

### Deferred to Separate Tasks

- Component-size refactoring (37 files >500 lines): dedicated architectural epic
- Supabase SQL migration fixups (KI-069–KI-080): E92 follow-up or dedicated migration cleanup story
- Test infrastructure improvements (KI-043, KI-055, KI-110): test-infrastructure-epic
- `src/premium/` type checking: premium build story
- Exhaustive silent-catch hardening across all 91 files: follow-up hardening sprint (Phase 4 covers the highest-impact ~25 sites)

## Context & Research

### Relevant Code and Patterns

- **TypeScript strict mode** is enabled (`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`)
- **ESLint config** at [eslint.config.js](eslint.config.js) — `.cjs` files need explicit Node globals + `no-require-imports` override
- **Known issues register** at [docs/known-issues.yaml](docs/known-issues.yaml) — several entries are stale; this plan includes a YAML audit step (R8)
- **BulkImportDialog** at [src/app/components/figma/BulkImportDialog.tsx](src/app/components/figma/BulkImportDialog.tsx) — 1882 lines; KI-101–KI-105 already fixed (generationRef, retryLockRef, originalCourseIdMapRef, try/catch, finally blocks all present)
- **ImportWizardDialog** at [src/app/components/figma/ImportWizardDialog.tsx](src/app/components/figma/ImportWizardDialog.tsx) — 1600+ lines; abortRef, generation counter checks, and `data-testid="wizard-url-input"` already present
- **syncableWrite.ts** at [src/lib/sync/syncableWrite.ts](src/lib/sync/syncableWrite.ts) — generic `<T extends SyncableRecord>` already declared at line 123
- **tableRegistry.ts** at [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts) — `cursorField: 'created_at'` already set for study_sessions, quiz_attempts, ai_usage_events
- **courseImport.ts** at [src/lib/courseImport.ts](src/lib/courseImport.ts) — `truncated?: boolean` already on ScannedCourse interface (line 156), returned at line 1962
- **Streak logic** at [src/lib/streak.ts](src/lib/streak.ts) — `useStreakStore.ts` no longer exists; streak logic refactored

### Institutional Learnings

- **[console-error-fix-implementation-lessons-2026-06-23.md](docs/solutions/developer-experience/console-error-fix-implementation-lessons-2026-06-23.md)** — Previous console error cleanup patterns
- **[course-import-data-integrity-2026-07-10.md](docs/solutions/database-issues/course-import-data-integrity-2026-07-10.md)** — Silent-catch pattern: hardcoded error strings discarding actual `err.message`
- **[implementation-lessons-deferred-issues-hardening-2026-06-28.md](docs/solutions/developer-experience/implementation-lessons-deferred-issues-hardening-2026-06-28.md)** — Documents the R3 hardening pass that discovered KI-101–KI-127; KI-101–KI-105 were subsequently fixed in commit `91d29166`

## Key Technical Decisions

- **Four phases, recommended order**: TypeScript → ESLint → MEDIUM bugs + silent catches → LOW polish. Phases 3 and 4 have no dependency on Phase 2 and can start after Phase 1.
- **Phase 1 must come first**: TypeScript errors block CI (`npm run ci` includes `typecheck`).
- **Conservative fix approach**: Minimal diffs. No refactoring unless the fix requires it. No architectural changes.
- **Silent catches get `console.error` at minimum**: Adding `console.error('[ComponentName]', err)` to empty catch blocks. Toast errors added only where user feedback is clearly needed (data mutations, imports).
- **Plan verified against current codebase**: All file paths, line numbers, and issue statuses verified via `tsc`, `grep`, and file reads on 2026-07-11.

## Implementation Units

---

## Phase 1: TypeScript Compilation Errors (32 errors → 0)

- [ ] **Unit 1.1: Fix unused declarations (12 errors)**

**Goal:** Remove or prefix unused imports, variables, and parameters.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/learning-path/RoadmapPhases.tsx` — remove unused `Clock` import (line 8), prefix unused `entry` param with `_` (line 138)
- Modify: `src/app/pages/LearningTrackDetail.tsx` — remove unused `reorderPathCourses` (line 55), `isEditing`, `setIsEditing` (line 75)
- Modify: `src/hooks/useCourseAdapter.ts` — remove unused `YouTubeCourseChapter` import (line 15)
- Modify: `src/lib/courseAdapter.ts` — remove unused `getCompanionPdfIds` import (line 15)
- Modify: `src/lib/courseImport.ts` — remove unused `serverRoot` (line 1683)
- Modify: `src/lib/lessonBasedCurriculum.ts` — prefix unused `prefix` with `_` (line 115), remove unused `buildSections` (line 554)
- Modify: `src/lib/trackManifestImport.ts` — remove unused `matchedFolder` (line 206)
- Modify: `src/lib/__tests__/lessonBasedCurriculum.test.ts` — remove unused `LessonGroup` import (line 10)

**Approach:**
- For truly unused imports: remove them
- For destructured params in callbacks: prefix with `_` (e.g., `_entry`)
- For destructured store values that may be needed later: prefix with `_` rather than removing

**Patterns to follow:**
- Existing `_` prefix convention in the codebase (e.g., `_query`, `_conversationHistory`)

**Test scenarios:**
- `npm run typecheck` shows zero `TS6133` errors

**Verification:**
- `npx tsc --noEmit` exits 0 with no unused declaration errors

---

- [ ] **Unit 1.2: Fix type assignability mismatches (6 errors)**

**Goal:** Align type unions with actual data shapes.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/lib/courseAdapter.ts` (line 190) — expand lesson type union to include `'quiz' | 'assignment' | 'material'`
- Modify: `src/lib/lessonBasedCurriculum.ts` (lines 191, 198, 449) — add explicit `string` type annotations for callback params; fix `LessonGroupItem[]` type mismatch

**Approach:**
1. `courseAdapter.ts:190`: The union only allows `'text' | 'video' | 'pdf'` but data contains `'quiz'`. Expand to `'text' | 'video' | 'quiz' | 'pdf' | 'assignment' | 'material'`.
2. `lessonBasedCurriculum.ts:191,198`: Add explicit `string` type annotations to `.map()` callback params.
3. `lessonBasedCurriculum.ts:449`: Add `as const` or explicit type annotation to source data.

**Test scenarios:**
- `npm run typecheck` shows zero `TS2322`/`TS7006` errors in these files

**Verification:**
- `npx tsc --noEmit` exits 0 with no type assignability errors

---

- [ ] **Unit 1.3: Fix null safety issues (11 errors)**

**Goal:** Add null guards to locations where strict null checks flag possible null access.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/lib/feedbackService.ts` (line 168) — add null guard for `supabase` client: `if (!supabase) throw new Error('Supabase client not initialized')`
- Modify: `src/lib/sync/__tests__/p2-course-book-sync.test.ts` (lines 161, 181, 191, 196, 205) — add `!` non-null assertions on `created` (test setup guarantees existence)
- Modify: `src/stores/__tests__/integration/import-workflow.test.ts` (lines 169, 236, 240, 244, 248) — add `!` non-null assertions on `author`

**Test scenarios:**
- `npm run typecheck` shows zero `TS18047` errors
- All existing tests pass

**Verification:**
- `npx tsc --noEmit` exits 0 with no null safety errors

---

- [ ] **Unit 1.4: Fix test mock mismatches (3 errors)**

**Goal:** Fix test files that import from wrong modules or provide incomplete mocks.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/__tests__/LessonsTab.test.tsx` (lines 18–19) — **fix import path**: change import from `LessonsTab` to `LessonsTabHighlightedTitle` (both `formatLessonDuration` and `LESSON_SEARCH_THRESHOLD` are exported from `LessonsTabHighlightedTitle.tsx` at lines 5 and 14)
- Modify: `src/app/components/course/__tests__/MaterialsTab.test.tsx` (line 63) — add `getLessonBasedCurriculum: vi.fn()` to the mock adapter

**Approach:**
1. `LessonsTab.test.tsx`: The symbols ARE exported — just from a different module. Update the import path rather than inlining production code.
2. `MaterialsTab.test.tsx`: Add the missing mock property.

**Test scenarios:**
- Tests compile and pass with fixed imports/mocks

**Verification:**
- `npx tsc --noEmit` exits 0 with no test file errors
- `npm run test:unit` — affected test files pass

---

## Phase 2: ESLint Errors & Script Configuration

- [ ] **Unit 2.1: Fix verify-dist.cjs ESLint errors (17 errors → 0)**

**Goal:** Configure ESLint to recognize `scripts/verify-dist.cjs` as a Node.js file with `require()` support.

**Requirements:** R2

**Dependencies:** Phase 1 complete (typecheck passing)

**Files:**
- Modify: `eslint.config.js` — add `scripts/**/*.cjs` to the Node globals configuration block AND add an override for `@typescript-eslint/no-require-imports: off` on `.cjs` files
- Modify: `scripts/verify-dist.cjs` — add `/* eslint-env node */` at the top

**Approach:**
1. Add `.cjs` to the existing Node globals pattern (fixes `no-undef` for `require`, `__dirname`, `process`, `console`).
2. Add `@typescript-eslint/no-require-imports: 'off'` override for `scripts/**/*.cjs` (fixes the 2 remaining errors).
3. Verify: `npm run lint` produces zero errors.

**Test scenarios:**
- `npm run lint` shows 0 errors
- `npm run lint` on other files produces same warnings as before

**Verification:**
- `npm run lint 2>&1 | grep "error"` shows zero errors

---

## Phase 3: MEDIUM Severity Issues & Silent Catch Hardening

- [ ] **Unit 3.1: Fix import wizard reliability gaps (verified-open KI items only)**

**Goal:** Fix the MEDIUM-severity issues in BulkImportDialog and ImportWizardDialog that were verified as still open. Several items from KI-109–KI-127 are already fixed (abortRef checks, generation counter, data-testid, retryLock) — this unit covers only the remaining gaps.

**Requirements:** R4

**Dependencies:** Phase 1

**Files:**
- Modify: `src/app/components/figma/BulkImportDialog.tsx`
- Modify: `src/app/components/figma/ImportWizardDialog.tsx`
- Modify: `src/app/components/figma/__tests__/BulkImportDialog.test.tsx`
- Modify: `src/app/components/figma/__tests__/ImportWizardDialog.test.tsx`
- Modify: `src/lib/courseImport.ts` — KI-119: make `MAX_SERVER_SCAN_FILES` a function parameter with default 5000

**Approach (verified-open items):**
- **KI-109**: Add test for cancel mid-import → remaining items show "Cancelled"
- **KI-111**: Add test for all-folders-empty → verify toast/error state
- **KI-112**: Add test for ImportWizardDialog URL scan network error → toast shown
- **KI-113**: Add tests for Enter/Escape keyboard guards during scan
- **KI-114**: Add concurrency test for retryLockRef (testable with Vitest fake timers — mock two concurrent handleRetry calls, resolve first after delay, assert second logs warning)
- **KI-115**: Disable Retry button while retryLock is active (persistent visual feedback) — no toast needed since button state conveys the information
- **KI-119**: Make `MAX_SERVER_SCAN_FILES` a function parameter with default 5000
- **KI-122**: Add per-item error state assertions in persist-rejection test
- **KI-124**: Normalize `console.error` vs `console.warn` — use `console.error` for actual errors
- **KI-125**: Rename local `gen` to `generationRef` for consistency
- **KI-127**: Rename `completedCount` to `settledCount` in `runWithConcurrency`

**Already fixed (excluded from this unit):**
- KI-120 (abortRef check) — already present at line 474
- KI-121 (generationRef gap) — already present at lines 474, 516, 625
- KI-126 (data-testid) — already present at line 944

**Test scenarios:**
- KI-109: Set `cancelRequested=true` mid-import → remaining items show "Cancelled"
- KI-114: Two concurrent `handleRetry` calls → second logs warning
- KI-115: Retry button visually disabled while retryLock active

**Verification:**
- All new tests pass
- `npm run typecheck && npm run lint && npm run build` clean

---

- [ ] **Unit 3.2: Fix sync and data integrity issues**

**Goal:** Fix verified-open MEDIUM-severity data integrity issues. The `supabase-cloud-sync-updated-at` issue (400 error on sync cycles) is already fixed via `cursorField: 'created_at'` in `tableRegistry.ts`.

**Requirements:** R4

**Dependencies:** Phase 1

**Files:**
- Modify: `src/lib/streak.ts` — KI-E95-S04-L01: add pages-goal branch to streak computation (was previously in `useStreakStore.ts`, now refactored to `src/lib/streak.ts`)
- Modify: `src/stores/useYouTubeImportStore.ts` — KI-E96-S04-L02: add `db.youtubeChapters.where('courseId').equals(courseId).delete()` to course-delete path
- Modify: `src/app/components/sync/LinkDataDialog.tsx` — stale-UI-after-fresh: dispatch Zustand store invalidation after `handleStartFresh()` rather than `window.location.reload()` (avoids jarring PWA full-page flash)

**Approach:**

**KI-E95-S04-L01 (src/lib/streak.ts):**
The pages-goal accumulation path was excluded from the streak backfill. On first authenticated boot, if streak data shows null counts, re-compute from local data including pages-goal users.

**KI-E96-S04-L02 (useYouTubeImportStore.ts):**
Add cascade delete for YouTube chapters when the parent course is deleted. Pre-existing orphan — chapters persist in Dexie after course deletion.

**stale-UI-after-fresh (LinkDataDialog.tsx):**
Replace the proposed `window.location.reload()` with targeted Zustand store invalidation. A hard reload is jarring for PWA users; store-level refresh achieves the same result without the flash.

**Test scenarios:**
- KI-E95-S04-L01: Pages-goal user signs in → streak displays correct count
- KI-E96-S04-L02: Delete imported course with YouTube chapters → chapters deleted
- LinkDataDialog: Start fresh → UI updates without page reload

**Verification:**
- `npm run typecheck && npm run build` clean

---

- [ ] **Unit 3.3: Silent catch hardening — high-impact production sites (~25 locations)**

**Goal:** Add `console.error` logging to the highest-impact silent catch blocks. ~91 files have `.catch(() => {})` patterns — this unit covers the ~25 most user-visible sites. Exhaustive coverage is deferred to a follow-up hardening sprint.

**Requirements:** R5

**Dependencies:** Phase 1

**Files (production code, highest user impact):**

*User-initiated actions (toast.error + console.error):*
- Modify: `src/app/components/figma/CurriculumComposer.tsx` (lines ~156, 175, 176, 189) — data load failures → toast
- Modify: `src/app/components/figma/YouTubeImportDialog.tsx` (line ~619) — transcript fetch → toast
- Modify: `src/stores/useLearningPathStore.ts` (lines ~749, 752, 885, 892) — bulkDelete, trackAIUsage → toast for delete, console for tracking
- Modify: `src/app/pages/learning-tracks/` (KI-093) — listing page load failure → toast

*Background operations (console.error only):*
- Modify: `src/app/components/course/tabs/NotesTab.tsx` (line ~90) — video description fetch
- Modify: `src/app/components/youtube/YouTubePlayer.tsx` (line ~118) — embeddability probe
- Modify: `src/app/components/figma/ProviderKeyAccordion.tsx` (lines ~108, 115) — refreshStatuses
- Modify: `src/app/hooks/useAudiobookshelfProgressSync.ts` (lines ~99, 131) — progress sync
- Modify: `src/app/hooks/useAudioPlayer.ts` (line ~370) — session cleanup
- Modify: `src/app/pages/UnifiedCourseDetail.tsx` (line ~187) — thumbnail URL fetch
- Modify: `src/ai/hooks/useTutor.ts` (line ~156) — session persistence
- Modify: `src/lib/pomodoroAudio.ts` (line ~58) — AudioContext close
- Modify: `src/lib/courseImport.ts` (line ~445) — scanCourseFolder
- Modify: `src/lib/autoAnalysis.ts` (lines ~122, 143) — trackAIUsage

*Zustand stores (console.error only — fire during init, no UI ready):*
- Modify: `src/stores/useWelcomeWizardStore.ts`, `useReaderStore.ts`, `useLessonChromeStore.ts`, `useAudiobookPrefsStore.ts`, `useReadingGoalStore.ts`, `useEngagementPrefsStore.ts`, `useQuizStore.ts`, `useYouTubeImportStore.ts`, `useTutorStore.ts` — add `console.error('[StoreName]', err)` to every empty catch that resets to defaults

**Approach:**
1. User-initiated actions: `toast.error('Operation failed. Please try again.')` + `console.error('[Component]', err)`
2. Background operations: `console.error('[Component]', err)` only
3. Store init: `console.error('[StoreName] Failed to load persisted state, using defaults:', err)`
4. Keep existing `// silent-catch-ok` comments but still add `console.error`

**Test scenarios:**
- Operations succeed → no console errors
- Operations fail → console.error with component prefix appears
- User action fails → toast shown to user

**Verification:**
- `npm run lint` — reduced `error-handling/no-silent-catch` warnings
- Manual: check browser console during normal usage

---

- [ ] **Unit 3.4: Add tests for uncovered critical paths (KI-106, KI-107, KI-108)**

**Goal:** Add test coverage for the three HIGH-severity untested code paths. These are the remaining KI items from the original 8 HIGH issues (KI-101–KI-105 already fixed, verified by commit `91d29166`).

**Requirements:** R3 (KI-106, KI-107, KI-108)

**Dependencies:** Phase 1

**Files:**
- Modify: `src/lib/__tests__/authorDetection.test.ts` — KI-106: `withKeyLock` concurrent test (2 concurrent calls for same name → exactly 1 author created)
- Modify: `src/lib/__tests__/trackManifestImport.test.ts` — KI-107: atomic author merge test (author + courses in single transaction)
- Create: `src/lib/__tests__/courseImport.server.test.ts` — KI-108: `scanCourseFolderFromServer` tests (happy, truncated, empty, error, dedup paths — note: function starts at line ~1664, `truncated: true` already returned at line 1962)

**Approach:**
- KI-106: Use `Promise.all` to fire two concurrent `matchOrCreateAuthor('Same Name')` → assert exactly 1 author
- KI-107: Mock `batchImportTrackCourses` with author manifest → verify atomicity
- KI-108: Mock `fetch` to return nginx autoindex HTML → test all paths including the already-implemented truncation at line 1962

**Test scenarios:**
- KI-106: 2 concurrent calls → exactly 1 author record
- KI-108: 6000 files across directories → capped at 5000, truncated flag true

**Verification:**
- `npm run test:unit` — new tests pass

---

## Phase 4: LOW Severity & Polish

- [ ] **Unit 4.1: Library component polish (KI-082–KI-089)**

**Goal:** Fix 8 LOW-severity issues in Library components.

**Requirements:** R7

**Dependencies:** None (independent)

**Files:**
- Modify: `src/app/components/library/LibraryShelfRow.tsx`
- Modify: `src/app/components/library/LibraryShelfHeading.tsx`
- Modify: `src/app/components/library/SmartGroupedView.tsx`

**Approach:**
- **KI-082**: Update JSDoc to reference `LibraryShelfHeading`
- **KI-083**: Make `LibraryShelfHeading` icon optional; when absent, text shifts fully left with no indent
- **KI-084**: Simplify `isChildrenEmpty()` to `Children.count(children) === 0`
- **KI-085**: Make icon prop optional with conditional render
- **KI-086**: Add `aria-label` refinement when count is present (e.g., `aria-label="30 items"`)
- **KI-087**: Document index-as-key as acceptable for static content; add explanatory comment
- **KI-088**: Normalize imports to `import type { ComponentType, ReactNode } from 'react'`
- **KI-089**: Expand JSDoc to clarify caller responsibility for `data-testid`

**Verification:**
- `npm run typecheck && npm run lint && npm run build` clean

---

- [ ] **Unit 4.2: Learning tracks UX fixes**

**Goal:** Fix LOW-severity UX and code issues in learning tracks pages (KI-090–KI-098, ki-2026-06-01-001–005). Design-decision items (KI-091, KI-095, KI-096) are resolved in-plan rather than deferred with comments.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/LearningTracks.tsx` — listing page
- Modify: `src/app/pages/LearningTrackDetail.tsx` — detail page
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/app/hooks/useCourseRoute.ts`
- Modify: `src/app/hooks/useCompletionFlow.ts`
- Modify: `src/app/pages/UnifiedLessonPlayer.tsx`

**Approach:**
- **KI-090**: Add `break-words` to hero heading on mobile
- **KI-093**: Add `toast.error()` in catch handler on listing page load failure
- **KI-094**: Change skeleton count from 3 to 4 on xl screens (matching 4-column grid)
- **KI-097**: Reduce hero section padding on mobile via responsive classes
- **KI-098**: Document the store-hydration timeout gap with a TODO comment (larger effort)
- **ki-2026-06-01-001**: Guard `onCourseClick` on `trackId` truthy before building `fromTrack` state
- **ki-2026-06-01-002**: Add `aria-hidden="true"` to `ArrowLeft` in `fromTrack` back-link
- **ki-2026-06-01-003**: Add empty-string guard: `` `Back to ${fromTrack.trackName || 'learning track'}` ``
- **ki-2026-06-01-004**: Extract `readFromTrack` narrowing guard to `src/lib/locationState.ts`
- **ki-2026-06-01-005**: Strip `autoPlay` before forwarding `location.state` in Prev/Next navigation
- **KI-091**: Keep current action labels (Edit, Change Cover) — they are sufficiently clear for both paths and tracks contexts
- **KI-095**: No contextual help text needed — the pages have distinct hero sections and titles
- **KI-096**: Keep `Layers` icon — it is visually distinct at current sidebar size; no user confusion reported

**Test scenarios:**
- KI-090: Long path name on mobile → text wraps
- KI-093: Listing page load fails → toast.error shown
- ki-2026-06-01-001: Navigate without trackId → no stale back-link
- ki-2026-06-01-005: Navigate Prev/Next → autoPlay not propagated

**Verification:**
- `npm run typecheck && npm run lint && npm run build` clean

---

- [ ] **Unit 4.3: Accessibility fixes**

**Goal:** Fix LOW-severity accessibility issues.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `src/app/components/sync/SyncUXShell.tsx` — add `data-testid='sync-live-region-assertive'`
- Modify: `src/app/components/Layout.tsx` — remove redundant `aria-live='polite'` from offline banner (keep `role='status'`)
- Modify: `src/app/components/authors/AuthorFormDialog.tsx` — specialty tag remove button: increase touch target to 44x44px via `min-h-[44px] min-w-[44px]`
- Modify: `src/app/pages/Authors.tsx` — fix focus ring: `ring-brand` → `ring-focus-ring` token
- Modify: `src/app/components/authors/AuthorFormDialog.tsx` — education input: increase `max-w-[16rem]` to `max-w-[24rem]`

**Test scenarios:**
- Specialty tag remove button ≥ 44x44px
- Author card focus ring uses correct design token

**Verification:**
- `npm run typecheck && npm run build` clean

---

- [ ] **Unit 4.4: Non-null assertion hardening (5 critical crash vectors)**

**Goal:** Add null guards to the highest-risk non-null assertions identified by searching for `!` on Map.get(), ref.current, and nullable array fields.

**Requirements:** R7

**Dependencies:** Phase 1

**Files:**
- Modify: `src/app/pages/SearchAnnotations.tsx` (line 164) — add null check on `groups.get(bookId)` before accessing `.results`
- Modify: `src/app/components/figma/VideoPlayer.tsx` (line 597) — add `if (!videoRef.current) return` before accessing `.currentTime`
- Modify: `src/stores/useBookStore.ts` (line 427) — add null guard on `filters.format` before calling `.includes()`
- Modify: `src/app/pages/SessionHistory.tsx` (lines 114, 413) — add null guard on `session.videosWatched` before `.map()`
- Modify: `src/app/components/reader/HighlightLayer.tsx` (lines 215, 326, 379, 435, 469, 516, 551) — add null checks on `highlightsRef.current.find()` results

**Verification:**
- `npm run typecheck && npm run build` clean

---

- [ ] **Unit 4.5: Update known-issues.yaml**

**Goal:** Mark all issues resolved by this plan as `status: fixed` in the known issues register.

**Requirements:** R8

**Dependencies:** All other phases

**Files:**
- Modify: `docs/known-issues.yaml`

**Approach:**
1. Mark KI-101–KI-105 as `status: fixed, fixed_by: commit 91d29166`
2. Mark KI-116, KI-118, KI-120, KI-121, KI-126 as `status: fixed, fixed_by: this plan`
3. Mark all KI items addressed in this plan as `status: fixed`
4. Update `supabase-cloud-sync-updated-at` entry as `status: fixed` (cursorField fix)
5. Remove KI-035 and KI-052 from any stale references (already fixed)

**Verification:**
- `grep "status: open" docs/known-issues.yaml` count is reduced

---

## System-Wide Impact

- **Interaction graph:** Fixes span 50+ files. No new callbacks, middleware, or observers. Changes are defensive (null guards, error logging) or corrective (type fixes).
- **Error propagation:** Previously silent errors now surface via `console.error`. User-initiated action failures show toast errors.
- **State lifecycle risks:** BulkImportDialog and ImportWizardDialog already have generation counters, abortRefs, and lock guards from commit `91d29166`.
- **Unchanged invariants:**
  - Dexie schema is not modified
  - Supabase migrations are not modified
  - React Router configuration is not modified
  - Auth flow is not modified
  - Sync engine behavior is not modified (cursorField fix already in place)
  - `syncableWrite<T>` API is not modified (generic already exists)

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Large blast radius (50+ files) — regression risk | Phases are self-contained. CI gates each phase. |
| Known-issues.yaml staleness may hide already-fixed items | Unit 4.5 audits and updates the register. Each implementer verifies issues against code before fixing. |
| Silent catch hardening may surface noisy console errors | Each catch gets a descriptive `[ComponentName]` prefix. Legitimate background failures become visible — this is desired. |
| Merge conflict with related plan (server course card parity) | Both plans touch `courseImport.ts`. This plan's Unit 3.1 modifies `MAX_SERVER_SCAN_FILES` parameterization only. Merge this plan first, then rebase the related plan. |

## Sources & References

- **Known issues register:** [docs/known-issues.yaml](docs/known-issues.yaml)
- **Commit fixing KI-101–KI-105:** `91d29166` — `fix(import): fix 5 HIGH-severity import bugs from R3 escalation (KI-101..KI-105)`
- **ESLint config:** [eslint.config.js](eslint.config.js)
- **TypeScript config:** [tsconfig.json](tsconfig.json)
- **syncableWrite.ts:** [src/lib/sync/syncableWrite.ts](src/lib/sync/syncableWrite.ts) — generic `<T extends SyncableRecord>` at line 123
- **tableRegistry.ts:** [src/lib/sync/tableRegistry.ts](src/lib/sync/tableRegistry.ts) — `cursorField: 'created_at'` at lines 136, 294, 644, 658
- **courseImport.ts:** [src/lib/courseImport.ts](src/lib/courseImport.ts) — `truncated?: boolean` at line 156, returned at line 1962
- **Related plan — server course card parity:** [docs/plans/2026-07-11-003-fix-server-course-card-parity-plan.md](docs/plans/2026-07-11-003-fix-server-course-card-parity-plan.md)

# Adversarial Review: Epic 89 — Course Experience Unification

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (adversarial)
**Epic:** E89 (11 stories: S01-S11)
**Verdict:** PASS WITH CONCERNS (14 findings: 3 HIGH, 6 MEDIUM, 5 LOW)

---

## Executive Summary

Epic 89 successfully unified three separate course systems into one route family with an adapter layer. The architecture is sound and the ~3,448-line dead code removal is a clear win. However, the epic shipped with alarming test coverage gaps (57% AC coverage), a leaky adapter abstraction that still checks `isYouTube` directly in page components, and PDF ordering that uses `pageCount` as a proxy for `order` — a time bomb for multi-PDF courses.

---

## Findings

### HIGH-1: Test Coverage at 57% Is Unacceptable for a Unification Epic

**Severity:** HIGH
**Category:** Testing blind spot

The traceability matrix shows 32 of 74 acceptance criteria have no direct test coverage. Entire stories have 0% coverage: S07 (Notes Panel: 0/7 ACs), S09 (Quiz Wiring: 0/5 ACs). For an epic whose explicit purpose was to *replace* existing pages with equivalent functionality, the lack of feature parity tests is a significant regression risk. If any of the old behaviors broke silently during unification, nothing would catch it.

**Evidence:** `docs/reviews/traceability/testarch-trace-e89-2026-03-30.md` — S05 at 33%, S06 at 17%, S07 at 0%, S09 at 0%.

**Recommendation:** Create a dedicated E2E spec `unified-course-feature-parity.spec.ts` that exercises every capability across both local and YouTube sources before any further refactoring.

---

### HIGH-2: Adapter Abstraction Is Leaky — `isYouTube` Checked 10+ Times in Page Components

**Severity:** HIGH
**Category:** Architectural weakness

The adapter pattern's stated goal was to eliminate source-specific branching in page components ("never checks `course.source` directly"). In reality, `UnifiedCourseDetail.tsx` checks `isYouTube` 6 times and `UnifiedLessonPlayer.tsx` checks it 4 times. These include conditional rendering (`{isYouTube && <AISummaryPanel />}`), prop passing (`isYouTube={isYouTube ?? false}`), and content switching (`isYouTube ? <YouTubeVideoContent> : <LocalVideoContent>`).

The adapter's `getCapabilities()` returns identical capabilities for both sources (both support notes, quiz, prev/next, breadcrumbs), making it effectively useless as a branching mechanism. The only real difference — `hasPdf: false` for YouTube — is never used for the main content branching, which still checks source type directly.

**Evidence:** `UnifiedCourseDetail.tsx:57,148,257,267,290,296`; `UnifiedLessonPlayer.tsx:292,314`.

**Recommendation:** Either commit to the adapter pattern fully (add `renderContent()` or `getContentComponent()` methods) or acknowledge the hybrid approach in architecture docs and remove the misleading "never checks source directly" claims.

---

### HIGH-3: PDF Order Uses `pageCount` as Proxy — Guaranteed Wrong Ordering

**Severity:** HIGH
**Category:** Data integrity / scope gap

`LocalCourseAdapter.getLessons()` at line 104 uses `p.pageCount` as the `order` field for PDF lessons because `ImportedPdf` has no `order` property. The inline comment acknowledges this: "adequate for MVP but may produce unexpected ordering for multi-PDF courses." A course with PDFs of 5, 12, and 3 pages would display them ordered 3, 5, 12 — sorted by page count, not by filename or import order.

The comment defers the fix to "S04/S06 where explicit PDF ordering will be added via a Dexie migration" — but S04 and S06 are both marked done without this migration. The fix was deferred and then forgotten.

**Evidence:** `src/lib/courseAdapter.ts:100-108`

**Recommendation:** Add an `order` field to `ImportedPdf` via Dexie migration, defaulting to filename-based alphabetical ordering for existing data.

---

### MEDIUM-4: No E89-Specific E2E Test Files Exist

**Severity:** MEDIUM
**Category:** Testing blind spot

The traceability matrix confirms "E2E test files (direct): 0." All E2E coverage comes from pre-existing regression specs and E54 specs written for other purposes. This means the unified pages were never intentionally tested end-to-end. The existing specs happen to exercise some paths because URLs were updated, but they were not designed to validate the unification.

---

### MEDIUM-5: Redirect Routes Accumulate Technical Debt Without Expiration

**Severity:** MEDIUM
**Category:** Technical debt

Routes.tsx contains 4 redirect components (ImportedCourseRedirect, ImportedLessonRedirect, YouTubeCourseRedirect, YouTubeLessonRedirect) each with `// TODO: Remove redirect after Epic E91+`. E91 is a different epic (lesson search, bookmark seek, etc.) — these TODOs reference a non-specific future removal. Without a concrete removal date or epic, these redirects will remain indefinitely, adding router complexity and bundle size.

**Evidence:** `src/app/routes.tsx:118-148`

---

### MEDIUM-6: UnifiedLessonPlayer at 482 Lines Exceeds the 300-Line Target

**Severity:** MEDIUM
**Category:** Code quality / scope creep

S05 AC9 and S04 AC8 both specify "Component ≤300 lines." UnifiedLessonPlayer is 482 lines — 61% over target. It manages video state, PDF lazy loading, auto-advance, celebrations, quiz buttons, side panels, resizable layouts, mobile sheets, breadcrumbs, and session tracking all in one component. This is a god component that violates the single responsibility principle the adapter pattern was meant to enable.

---

### MEDIUM-7: `useCourseAdapter` Hook Fires 3 Separate Dexie Queries Per Course Load

**Severity:** MEDIUM
**Category:** Performance

The hook at `src/hooks/useCourseAdapter.ts:26-30` makes three sequential `db.` calls (importedCourses.get, importedVideos.where, importedPdfs.where) every time the reactive query reruns. Then `UnifiedCourseDetail.tsx:92-101` makes the same three queries again plus two more (youtubeChapters, progress). A single course detail page load triggers at minimum 5 Dexie round-trips, and the first 3 are duplicated between the hook and the page component.

**Recommendation:** Either expand the adapter hook to include all needed data, or remove the duplicate queries from the page component.

---

### MEDIUM-8: Blob URL Memory Leak Risk in Thumbnail Cleanup

**Severity:** MEDIUM
**Category:** Memory management

`UnifiedCourseDetail.tsx:126-146` cleans up blob URLs on unmount via `thumbnailUrlRef`. However, if the adapter changes (causing the effect to re-run) before unmount, the previous blob URL stored in `thumbnailUrlRef.current` is overwritten without being revoked. The cleanup function only runs on the *next* re-run, but by then `thumbnailUrlRef.current` already points to the new URL, leaking the old one.

---

### MEDIUM-9: Retrospective Not Completed

**Severity:** MEDIUM
**Category:** Process gap

`sprint-status.yaml:1078` shows `epic-89-retrospective: optional`. For an 11-story unification epic that consolidated 3 course systems, a retrospective should be mandatory, not optional. The patterns and lessons from this complex refactoring are directly relevant to future unification work.

---

### LOW-10: `hasTranscript: true` Hardcoded for Local Courses Is Misleading

**Severity:** LOW
**Category:** Semantic correctness

`LocalCourseAdapter.getCapabilities()` returns `hasTranscript: true` with the comment "Local courses can have caption files." Having the *capability* to have transcripts is not the same as actually having a transcript. This should be dynamically computed based on whether any VideoCaptionRecords exist for the course.

---

### LOW-11: `EditCourseDialog` Still Checks `course.source` Directly

**Severity:** LOW
**Category:** Inconsistency

`src/app/components/figma/EditCourseDialog.tsx:58` uses `course.source === 'youtube'` directly, bypassing the adapter. While this is a pre-existing component not created by E89, the epic should have refactored consumers to use the adapter pattern consistently.

---

### LOW-12: No Migration Test for Dexie Schema Changes

**Severity:** LOW
**Category:** Testing gap

S01-AC4 required a Dexie v30 migration to drop the `courses` table. The traceability matrix marks this as "PARTIAL — no dedicated migration test found." Schema migrations are high-risk operations that can corrupt user data if they fail, and they deserve dedicated test coverage.

---

### LOW-13: `CourseProgress` Only Counts Videos, Ignores PDFs

**Severity:** LOW
**Category:** Feature parity gap

`UnifiedCourseDetail.tsx:158-160` computes `completedCount` by filtering `videos` only: `videos.filter(v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= 90)`. The `totalCount` at line 289 is also `videos.length`. PDF completions are excluded from progress tracking, which means a course with 10 videos and 5 PDFs would show "10/10 complete" when all content is done, ignoring the PDFs entirely.

---

### LOW-14: `isYouTube ?? false` Suggests Nullable Boolean Smell

**Severity:** LOW
**Category:** Type safety

`UnifiedCourseDetail.tsx:257,296` uses `isYouTube ?? false` — the nullish coalescing implies `isYouTube` might be `undefined`. Since `adapter?.getSource()` returns `undefined` when adapter is null, and the component already guards against `!adapter` at line 233, `isYouTube` should never be nullish at that point. This is either dead defensive code or a sign the type narrowing is incomplete.

---

## Summary Table

| # | Severity | Category | Finding |
|---|----------|----------|---------|
| 1 | HIGH | Testing | 57% AC coverage — 32 of 74 ACs untested |
| 2 | HIGH | Architecture | Adapter abstraction leaky — `isYouTube` checked 10+ times in pages |
| 3 | HIGH | Data integrity | PDF ordering uses `pageCount` as proxy, deferred fix was forgotten |
| 4 | MEDIUM | Testing | Zero E89-specific E2E test files |
| 5 | MEDIUM | Tech debt | Redirect routes have no expiration plan |
| 6 | MEDIUM | Code quality | UnifiedLessonPlayer 482 lines (target: 300) |
| 7 | MEDIUM | Performance | 5+ Dexie queries per page load, 3 duplicated |
| 8 | MEDIUM | Memory | Blob URL leak on adapter change before unmount |
| 9 | MEDIUM | Process | Retrospective skipped for complex unification epic |
| 10 | LOW | Semantics | `hasTranscript: true` hardcoded regardless of actual data |
| 11 | LOW | Consistency | EditCourseDialog bypasses adapter pattern |
| 12 | LOW | Testing | No Dexie migration test |
| 13 | LOW | Feature parity | CourseProgress ignores PDF completions |
| 14 | LOW | Type safety | Unnecessary nullish coalescing on `isYouTube` |

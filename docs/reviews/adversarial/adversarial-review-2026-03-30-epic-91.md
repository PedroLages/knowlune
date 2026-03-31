# Adversarial Review: Epic 91 — Video Player Enhancements

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Epic:** E91 — Video Player Enhancements (14 stories, all marked done)
**Verdict:** CONDITIONAL PASS — 14 findings, 3 critical

---

## Critical Issues (3)

### F01: UnifiedLessonPlayer is a God Component (711 lines, 49 hooks)
**Severity:** CRITICAL — Maintainability / Architecture
**Evidence:** `src/app/pages/UnifiedLessonPlayer.tsx` has 49 hook calls (useState/useEffect/useCallback/useMemo/useRef combined). Epic 91 added theater mode, mini-player, tablet toggle, bookmark seek, frame capture wiring, caption customization, and clickable timestamps — all threaded through this single component.
**Risk:** Every future player feature requires modifying this file. Merge conflicts are inevitable if parallel work touches it. Re-render cascades from 49 hooks degrade performance on lower-end devices.
**Recommendation:** Extract a `useLessonPlayerState()` composite hook or split into sub-components with context providers. PlayerSidePanel (974 lines) has the same problem.

### F02: Massive Review Gate Skipping Across the Epic
**Severity:** CRITICAL — Process / Quality Confidence
**Evidence:** Across 14 stories:
- **E91-S04** (MiniPlayer): design-review-skipped, performance-benchmark-skipped, exploratory-qa-skipped
- **E91-S07** (Bookmarks): design-review-skipped, performance-benchmark-skipped, security-review-skipped, exploratory-qa-skipped (4 of 6 agents skipped)
- **E91-S09** (Tablet): e2e-tests-skipped, design-review-skipped, performance-benchmark-skipped, exploratory-qa-skipped (worst offender)
- **E91-S12** (Export): lint-skipped, design-review-skipped, performance-benchmark-skipped, exploratory-qa-skipped
- **E91-S14** (Timestamps): design-review-skipped, exploratory-qa-skipped
- **0 of 14 stories** had burn-in validation

Performance benchmarks were skipped on 10 of 14 stories. Exploratory QA was skipped on 10 of 14 stories. This is a video player epic — the most interaction-heavy, performance-sensitive surface in the app — yet it received the least live testing.
**Recommendation:** Run a consolidated performance benchmark and exploratory QA pass across the entire epic before closing it.

### F03: E91-S06 is a Three-in-One Frankenstory
**Severity:** CRITICAL — Scope / Testability
**Evidence:** "Frame Capture + PDF Page Tracking + Mobile Notes Overlay" bundles three unrelated features into one story. These have zero domain overlap: canvas-based video frame export, Dexie persistence for PDF pages, and a fullscreen overlay with focus trap. The story's own E2E tests skip transcript seeding infrastructure.
**Risk:** If any one feature regresses, bisecting to this commit is unhelpful — the diff touches video, PDF, and mobile layout code simultaneously. Each feature deserved its own story with focused E2E coverage.

---

## High Issues (4)

### F04: MiniPlayer Silent Autoplay Catch with No User Feedback
**Severity:** HIGH — UX / Silent Failure
**Evidence:** `MiniPlayer.tsx:73` — `miniVideo.play().catch(() => { // silent-catch-ok: autoplay may be blocked })`. If the browser blocks autoplay (common on Safari, Firefox strict mode), the mini-player appears but the video is frozen with no indication to the user.
**Recommendation:** Show a play button overlay or muted-autoplay fallback when autoplay is blocked, rather than rendering a frozen video.

### F05: No Epic-Level Planning Artifact
**Severity:** HIGH — Process
**Evidence:** No `docs/planning-artifacts/` file exists for Epic 91. The epic has 14 stories but no PRD, no epic brief, no requirements document. Stories were created directly without a planning phase.
**Risk:** No traceability from business goals to stories. No way to verify completeness against original requirements.

### F06: Theater Mode Keyboard Shortcut Conflict Risk
**Severity:** HIGH — UX
**Evidence:** E91-S03 AC5 adds `T` as a keyboard shortcut for theater mode toggle via a `keydown` listener on `document`. This will fire when the user types "T" in the notes editor, search input, or any text field.
**Recommendation:** Verify the implementation guards against `event.target` being an input/textarea/contenteditable element.

### F07: No Cross-Story Integration Testing
**Severity:** HIGH — Testing
**Evidence:** Each story has isolated E2E tests, but no tests verify feature interactions: theater mode + mini-player, bookmark seek + clickable timestamps, caption customization + theater mode, tablet toggle + notes fullscreen overlay. These features share the same player surface and state.

---

## Medium Issues (5)

### F08: Caption Customization Settings Not Synced Across Tabs
**Severity:** MEDIUM — UX
**Evidence:** E91-S13 adds font size and background opacity customization for captions. If persisted to localStorage (like theater mode), opening the app in two tabs will have stale settings in the second tab.

### F09: Next Course Suggestion Algorithm is Naive
**Severity:** MEDIUM — Product
**Evidence:** E91-S08 AC5 — suggestion prioritizes tag overlap count, then import date. No consideration for: course difficulty progression, partially started courses, user's study history, or courses the user has already dismissed. A user who imports 50 courses will always get the same suggestion.

### F10: PDF Page Tracking May Require Dexie Migration Not Tested
**Severity:** MEDIUM — Data Integrity
**Evidence:** E91-S06 Task 2.5 notes "Check if VideoProgress type has currentPage field — if not, add it to types.ts and create a Dexie migration." If a migration was added, existing users' databases may not upgrade cleanly. No migration test exists.

### F11: Lesson Search Threshold Hardcoded at 8
**Severity:** MEDIUM — UX
**Evidence:** E91-S11 hides search when courses have 8 or fewer lessons. This is arbitrary — a user scrolling through 7 long-titled lessons on mobile still benefits from search. The threshold should account for viewport size or be configurable.

### F12: Frame Capture Uses Date.now() in Production
**Severity:** MEDIUM — Consistency
**Evidence:** E91-S06 Task 1.4 explicitly notes `frame-${Date.now()}.jpg` as an exception to the deterministic time rule. While justified for user-initiated actions, this means frame capture filenames are untestable in E2E without mocking, and the story acknowledges this exception rather than using a more testable approach (e.g., formatted date string).

---

## Low Issues (2)

### F13: Retrospective Not Completed
**Severity:** LOW — Process
**Evidence:** `epic-91-retrospective: optional` in sprint-status.yaml. For a 14-story epic that introduced significant architectural complexity to the player, a retrospective would capture lessons about the god-component growth and review-skipping patterns.

### F14: Inconsistent Story Granularity
**Severity:** LOW — Planning
**Evidence:** Story sizes vary wildly: S06 bundles 3 features, while S14 (clickable note timestamps) is a single focused feature. S09 (tablet layout) and S11 (lesson search) are also single-feature. The epic lacks consistent story sizing, making velocity tracking unreliable.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 2 |
| **Total** | **14** |

**Top 3 Actions:**
1. Run consolidated performance benchmark + exploratory QA across all 14 stories (addresses F02)
2. Plan a refactoring story to decompose UnifiedLessonPlayer and PlayerSidePanel (addresses F01)
3. Add integration E2E tests that exercise multiple E91 features together (addresses F07)

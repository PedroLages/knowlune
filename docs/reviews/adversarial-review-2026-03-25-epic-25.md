# Adversarial Review: Epic 25 — Author Management & New User Experience

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Scope:** E25-S01 through E25-S09 (9 stories: Author Data Model, CRUD, Authors Page, Auto-Detection, Photo Detection, Course Linking, Onboarding, Progressive Disclosure, Empty States)
**Verdict:** Medium-risk epic with strong core implementation but significant testing gaps and two unreviewed stories.

---

## Findings Summary

| # | Severity | Category | Finding |
|---|----------|----------|---------|
| 1 | CRITICAL | Process | Two stories shipped without `/review-story` (S07, S08) |
| 2 | HIGH | Testing Gap | E25-S09 completed zero of its planned E2E tests (Task 7 unchecked) |
| 3 | HIGH | Architecture | Race condition in `matchOrCreateAuthor()` — read-then-write without transaction |
| 4 | HIGH | Testing Gap | Progressive disclosure tests only 2 of 6 disclosure keys |
| 5 | MEDIUM | Scope Creep | E25-S01 and E25-S03 have overlapping scope — S03 bundles S01 prerequisites |
| 6 | MEDIUM | Architecture | `addAuthor` uses optimistic update before persistence, contradicting project convention |
| 7 | MEDIUM | UX Debt | Social link URLs stored without validation — `javascript:` injection possible |
| 8 | MEDIUM | Testing Gap | No E2E tests for author CRUD dialogs (S02 entirely unit-tested) |
| 9 | MEDIUM | Testing Gap | No mobile viewport tests for onboarding (S07) or disclosure (S08) |
| 10 | MEDIUM | Architecture | Progressive disclosure uses CustomEvent + localStorage — fragile cross-component communication |
| 11 | LOW | Code Quality | `matchOrCreateAuthor` comment says "slug-based ID" but uses `crypto.randomUUID()` |
| 12 | LOW | Testing Gap | Onboarding existing-user detection (AC5) has no test |
| 13 | LOW | Process | E25-S06 story file is barebones — no frontmatter, incomplete sections |
| 14 | LOW | UX Debt | Onboarding overlay uses hardcoded localStorage key `levelup-onboarding-v1` (stale brand name) |

---

## Detailed Findings

### 1. [CRITICAL] Two Stories Shipped Without Review

**Stories:** E25-S07 (Onboarding Overlay), E25-S08 (Progressive Sidebar Disclosure)

Both stories have `reviewed: false` and `review_gates_passed: []` in their frontmatter. They were merged to main via PRs (#60, #61) without running `/review-story`. This means:
- No code review agent analyzed the implementation
- No design review agent checked UI/UX
- No test coverage agent verified AC mapping
- Quality gates (build, lint, type-check) may have passed via CI but not through the structured review process

E25-S07 has 5 passing E2E tests and notes "All 2206 unit tests pass," suggesting manual verification occurred. E25-S08 has 8 E2E tests. But the absence of formal review means both stories bypassed the project's quality assurance framework.

**Impact:** Two stories' implementations have not been adversarially examined. Patterns like the `__test_show_onboarding` flag, the `sidebar-unlock` CustomEvent mechanism, and the localStorage persistence in disclosure have not been scrutinized for edge cases, silent failures, or architectural concerns.

**Recommendation:** Run `/review-story` retroactively on both stories, or accept the gap and document it in the retrospective.

---

### 2. [HIGH] E25-S09 Completed Zero E2E Tests

**File:** `docs/implementation-artifacts/25-9-empty-state-improvements.md:84`

Task 7 ("Add E2E tests for new standardized empty states") is the only unchecked task in S09. The story refactored 4 pages to use the shared `EmptyState` component but added no new test coverage. The story relies on pre-existing E10-S02 regression tests, but those tests were written for the old ad-hoc empty states, not the refactored implementations.

**Impact:** If the `EmptyState` component's `onAction` or `actionHref` props have wiring bugs, they will not be caught. The AC5 (CTA navigation) and AC6 (content replacement) behaviors are completely untested.

**Recommendation:** Add at least 2-3 E2E tests covering CTA navigation from empty states (e.g., MyClass empty state -> import CTA -> /courses navigation).

---

### 3. [HIGH] Race Condition in `matchOrCreateAuthor()`

**File:** `src/lib/authorDetection.ts:63-93`

The function performs:
1. `db.authors.toArray()` — reads all authors
2. Linear scan for case-insensitive match
3. If no match: `db.authors.add()` — creates new author

Steps 1-3 are not wrapped in a Dexie transaction. If two imports run concurrently (e.g., batch import feature in a future epic), the same author name could be detected twice, creating duplicate author records. The code review for S04 identified this as HIGH but accepted it because "single-import UX pattern" mitigates the risk.

**Impact:** Current risk is LOW (single-import UX), but this is a time bomb for any future batch import feature. The `toArray()` also loads all authors into memory for every import — inefficient if the author table grows.

**Recommendation:** Wrap in `db.transaction('rw', db.authors, async () => { ... })`. Replace `toArray()` + linear scan with `db.authors.where('name').equalsIgnoreCase(normalizedInput).first()` for efficiency.

---

### 4. [HIGH] Progressive Disclosure Tests Only Cover 2 of 6 Keys

**File:** `tests/e2e/regression/story-e25-s08.spec.ts`

The E2E tests verify:
- `course-imported` -> reveals Authors
- `lesson-completed` -> reveals Study Analytics, Quiz Analytics

But 4 disclosure keys are untested:
- `note-created` -> Notes
- `review-used` -> Review, Retention
- `challenge-used` -> Challenges, Session History
- `ai-used` -> Learning Path, Knowledge Gaps, AI Analytics

The `GATED_ITEMS` constant in the test file (line 20-27) defines all 6 keys, but only 2 are exercised in actual test cases. The "Show all" toggle test (AC3) verifies all items appear, but that tests the override, not the individual unlock behavior.

**Impact:** If a specific disclosure key's wiring breaks (e.g., `challenge-used` is misspelled in `navigation.ts`), no test catches it. Each key maps to a different subset of navigation items — a typo in any one key silently hides features.

**Recommendation:** Add a parameterized test that iterates over all 6 keys, unlocking each and verifying the expected items appear.

---

### 5. [MEDIUM] Overlapping Scope Between S01 and S03

**Files:** `25-1-author-data-model-and-migration.md`, `25-3-authors-page-from-indexeddb.md`

S03's "Prerequisites (E25-S01 scope bundled)" section states it "bundles the E25-S01 data model work since it hasn't been completed." Yet S01 is marked as `done` and was merged via PR #54 before S03 (PR #56). This means either:
- S01 was completed after S03's story file was written (the story file is stale), or
- S01's scope was partially implemented in S03

The commit history shows S01 merged first (PR #54: `839f80df`) then S03 (PR #56: `4e07fb45`), so the story file's claim is misleading. S03 did additional work beyond S01 (AuthorView type, getMergedAuthors, search/sort) but the bundling note creates confusion about which story owns which changes.

**Impact:** Traceability confusion — it is unclear which story's AC is satisfied by which code. This makes future maintenance harder ("which story do I reference when fixing the author migration?").

**Recommendation:** Update S03's story file to remove the "bundled" note and clarify that S01 completed the data model work.

---

### 6. [MEDIUM] Optimistic Updates Contradict Project Convention

**File:** `src/stores/useAuthorStore.ts:112-115, 145-148, 174-176`

The project's pre-review checklist states: "No optimistic UI updates before persistence — state updates after DB write succeeds." Yet `addAuthor`, `updateAuthor`, and `deleteAuthor` all update the store state optimistically before calling `persistWithRetry`. All three have rollback logic on failure.

This is internally consistent (all 3 methods follow the same pattern) and matches the quiz store and progress store patterns cited in the E24 retrospective. But it contradicts the explicit project convention. Either the convention is wrong or the implementation is wrong.

**Impact:** If persistence fails, the user briefly sees the new/updated/deleted author before rollback. For delete with undo, the optimistic pattern is arguably correct UX. For create/update, it could confuse users who see a flash of success followed by an error toast.

**Recommendation:** Either update the pre-review checklist to say "Optimistic updates are acceptable when paired with rollback" or change addAuthor/updateAuthor to update state after persistence.

---

### 7. [MEDIUM] Social Link URLs Not Validated

**File:** `src/stores/useAuthorStore.ts:20-21`

`socialLinks` accepts arbitrary strings for `website`, `twitter`, `linkedin`. These are rendered as `<a href>` tags in the author profile. While React auto-escapes HTML content, `href="javascript:alert(1)"` would execute on click. In a personal, local-first app, the user controls all input, so the risk is theoretical. But the pattern sets a bad precedent.

**Recommendation:** Add URL validation (`^https?://`) in the form submission handler, not just the store.

---

### 8. [MEDIUM] No E2E Tests for Author CRUD Dialogs

**Stories:** E25-S02

All S02 coverage is unit tests (`AuthorFormDialog.test.tsx`, `DeleteAuthorDialog.test.tsx`, `Authors.test.tsx`). No E2E test:
- Opens the Add Author dialog
- Fills the form with valid data
- Submits and verifies the author appears in the grid
- Edits an author
- Deletes an author with confirmation

Unit tests mock the store and dialog primitives, so they do not test the actual form-to-store-to-DB-to-UI pipeline.

**Recommendation:** Add 1-2 E2E smoke tests for create + delete flows.

---

### 9. [MEDIUM] No Mobile Viewport Tests

**Stories:** E25-S07 (AC7: mobile-responsive overlay), E25-S08 (AC9: mobile bottom nav respects disclosure)

Both stories have acceptance criteria specifying mobile behavior:
- S07 AC7: "Mobile-responsive overlay"
- S08 AC9: "Mobile bottom nav respects disclosure rules"

Neither has E2E tests at mobile viewport (< 640px). The project's design principles require mobile-first approach with a 640px breakpoint. The `BottomNav` component filters items through `getPrimaryNav()`/`getOverflowNav()` but these functions do not receive filtered groups from the disclosure hook — they use the static `navigationItems` array.

**Impact:** The mobile bottom nav may show ALL items regardless of disclosure state. If `BottomNav` does not integrate with `useProgressiveDisclosure`, the entire disclosure feature is desktop-only.

**Recommendation:** Verify `BottomNav` integration with disclosure hook. Add at least 1 mobile-viewport E2E test.

---

### 10. [MEDIUM] Progressive Disclosure Uses Fragile Communication Pattern

**File:** `src/app/hooks/useProgressiveDisclosure.ts:71-85, 166-180`

The disclosure system uses three communication channels:
1. `window.addEventListener('sidebar-unlock', handler)` — CustomEvent from `unlockSidebarItem()`
2. `window.addEventListener('storage', handler)` — cross-tab synchronization
3. `window.addEventListener('disclosureUpdated', handler)` — same-tab Settings toggle

The `unlockSidebarItem()` helper (line 172) persists to localStorage AND dispatches a CustomEvent, creating a dual-write pattern. If the hook is not mounted when `unlockSidebarItem` is called, the localStorage write persists but the CustomEvent is lost — which is fine because the hook reads from localStorage on mount. But if the hook IS mounted, both the CustomEvent handler and a potential storage event fire, causing a double state update.

**Impact:** Potential double-render on unlock. Not a correctness issue (Set deduplication prevents duplicate keys), but unnecessary work. More importantly, the three event channels create maintenance complexity — a future developer might not understand why three listeners are needed or might break one without realizing the others compensate.

**Recommendation:** Simplify to localStorage-only with a single `storage` event listener, or document the rationale for the triple-channel approach.

---

### 11. [LOW] Misleading Comment in matchOrCreateAuthor

**File:** `src/lib/authorDetection.ts:79`

Comment says `// Create new author with slug-based ID` but the code uses `crypto.randomUUID()` which generates a UUID, not a slug. S04 code review identified this as a NIT.

---

### 12. [LOW] Onboarding Existing-User Detection Untested

**File:** `tests/e2e/onboarding.spec.ts`

S07 AC5 states: "If user already has imported courses, don't show the overlay." The implementation checks `useCourseImportStore` in `useOnboardingStore.initialize()`, but no E2E test seeds imported courses and then verifies the overlay does not appear. The existing test for "does not show onboarding if already completed" (line 92) only checks the localStorage completion flag, not the course-existence bypass.

---

### 13. [LOW] E25-S06 Story File Is Barebones

**File:** `docs/implementation-artifacts/25-6-link-imported-courses-to-author-profiles.md`

S06 lacks:
- YAML frontmatter (no `story_id`, `status`, `reviewed` fields)
- Pre-Review Checklist section
- Design Review / Code Review / Web Design Guidelines sections
- Standard "Challenges and Lessons Learned" formatting

Other stories in the epic have complete frontmatter. S06 reads like a summary written post-implementation rather than a story file used during development.

---

### 14. [LOW] Stale Brand Name in Onboarding localStorage Key

**File:** `tests/e2e/onboarding.spec.ts:14`

The onboarding localStorage key is `levelup-onboarding-v1`, using the old "LevelUp" brand name. The app is now called "Knowlune." Other localStorage keys use the correct name (e.g., `knowlune-sidebar-disclosure-v1`, `knowlune-welcome-wizard-v1`). This inconsistency suggests the onboarding system was implemented during an earlier epic (E10-S01) and never renamed.

**Impact:** No functional impact — the key works regardless of naming. But it creates confusion when debugging localStorage contents and is inconsistent with the project's naming convention.

---

## Verdict

Epic 25 delivered a substantial feature set across 9 stories: a complete author management system (data model, CRUD, auto-detection, photo scoring, course linking), a first-use onboarding overlay, progressive sidebar disclosure, and standardized empty states. The core author infrastructure (S01-S05) is well-architected with clean separation between pure detection logic and async DB operations.

The primary concerns are:
1. **Process gap:** Two stories (S07, S08) bypassed the review framework entirely
2. **Testing gaps:** S09 shipped with zero new tests; S08 tests only 2/6 disclosure keys; S02 has no E2E coverage
3. **Mobile blindspot:** Neither S07 nor S08 verified mobile-specific ACs

The architecture is sound — the author detection pipeline, progressive disclosure hook, and unified AuthorView type are patterns worth reusing. The race condition in `matchOrCreateAuthor()` is the only technical debt that needs attention before any batch import feature.

**Overall risk:** MEDIUM. The shipped features work correctly for the current single-user, desktop-primary use case. The gaps are in edge case coverage, mobile testing, and process compliance — not in core functionality.

---

*Generated by Adversarial Review Workflow on 2026-03-25*

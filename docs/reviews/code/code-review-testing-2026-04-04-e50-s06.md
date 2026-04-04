# Code Review (Testing) — E50-S06: SRS Events in Feed + Overview Widget

**Date:** 2026-04-04  
**Reviewer:** Test Coverage Agent (Claude Sonnet)  
**Story:** E50-S06 — SRS Events in Feed + Overview Widget

---

## AC Coverage Table

| AC | Description | Test | Status |
|----|-------------|------|--------|
| AC1 | SRS "Review: X flashcards due" event in feed for days with due cards | No E2E test for feed endpoint (server-side) | ⚠️ GAP |
| AC2 | No SRS events for days with 0 due cards | No E2E test | ⚠️ GAP |
| AC3 | Today's study blocks in time order | `story-e50-s06.spec.ts:68` | ✅ |
| AC4 | Flashcard due count with "Review now" button | `story-e50-s06.spec.ts:109` | ✅ |
| AC5 | Empty state when no schedules or due cards | `story-e50-s06.spec.ts:43` | ✅ |
| AC6 | Start button navigates to course page | `story-e50-s06.spec.ts:152` | ✅ |

---

## Findings

### ADVISORY: AC1/AC2 — No tests for SRS iCal events in feed

The `generateSRSSummaryEvents()` function has full implementation but no automated tests. AC1 and AC2 are critical to the story's promise of SRS events appearing in calendar feeds.

**Suggested tests** (unit tests in `src/lib/__tests__/icalFeedGenerator.test.ts`):
- `generateSRSSummaryEvents([{date: '2025-01-15', count: 3}], '09:00', 'UTC')` → returns iCal string with 1 VEVENT containing "Review: 3 flashcards due"
- `generateSRSSummaryEvents([], '09:00', 'UTC')` → returns empty string
- UID format: output contains `srs-2025-01-15@knowlune.app`
- DURATION: event spans 30 minutes

---

## Test Quality Assessment

**AC3-AC6 tests are well-written:**
- Proper `addInitScript` for date mocking
- Onboarding overlay dismissal via localStorage (correctly dismisses both WelcomeWizard + OnboardingOverlay)
- `toBeVisible({ timeout: 15000 })` for flashcard visibility accommodates Overview's 500ms skeleton delay
- Factory pattern used for test data
- `page.reload({ waitUntil: 'networkidle' })` after seeding for Zustand re-load

---

## Verdict

4/6 ACs covered by E2E tests. AC1/AC2 (feed SRS events) have an advisory gap — no unit tests for `generateSRSSummaryEvents`. The widget behavior (AC3-AC6) is well-tested.

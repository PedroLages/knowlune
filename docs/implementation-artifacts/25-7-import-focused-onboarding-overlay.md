---
story_id: E25-S07
story_name: "Import-Focused Onboarding Overlay"
status: in-progress
started: 2026-03-25
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 25.07: Import-Focused Onboarding Overlay

## Story

As a new user,
I want a welcoming overlay that guides me to import my first course,
so that I understand the primary workflow.

## Acceptance Criteria

- AC1: First-time users see a welcome overlay when they first visit the app
- AC2: The overlay highlights importing a course as the primary action
- AC3: Steps flow: "Welcome to Knowlune" title, import-focused description, "Import a Course" CTA
- AC4: Dismiss overlay via skip button, X button, or Escape key; persist dismissal in localStorage
- AC5: If user already has imported courses, don't show the overlay
- AC6: Clean, inviting design using the app's brand colors
- AC7: Mobile-responsive overlay

## Tasks / Subtasks

- [x] Task 1: Render OnboardingOverlay in Layout.tsx (AC: 1)
- [x] Task 2: Add existing-user detection -- skip if courses already imported (AC: 5)
- [x] Task 3: Update Step 1 messaging to be import-focused with brand CTA (AC: 2, 3, 6)
- [x] Task 4: Update E2E tests with __test_show_onboarding flag pattern (AC: 4)
- [x] Task 5: Seed onboarding dismissal in navigateAndWait to prevent overlay blocking other tests

## Implementation Notes

The onboarding system (store, overlay, step components) already existed from E10-S01 but the
`OnboardingOverlay` was never rendered in the Layout. This story:

1. Added `<OnboardingOverlay />` to Layout.tsx
2. Enhanced `useOnboardingStore.initialize()` to check `useCourseImportStore` for existing courses
3. Updated Step 1: icon to FolderOpen, title to "Welcome to Knowlune", import-focused description,
   brand-variant CTA button reading "Import a Course"
4. Updated `navigateAndWait()` to auto-dismiss onboarding in tests (using `__test_show_onboarding`
   opt-out flag for tests that need the overlay visible)

## Testing Notes

- All 5 onboarding E2E tests pass
- All 6 navigation E2E tests pass
- All 16 E10-S02 empty state regression tests pass
- All 2206 unit tests pass
- No new lint errors introduced

## Pre-Review Checklist

- [x] All changes committed
- [x] No error swallowing
- [x] useEffect hooks have cleanup functions
- [x] No optimistic UI updates before persistence
- [x] E2E tests updated for overlay rendering in Layout

## Challenges and Lessons Learned

- The OnboardingOverlay component existed but was never mounted in Layout, causing the entire
  onboarding flow to be invisible. Always verify components are actually rendered, not just defined.
- Adding a modal overlay to the root Layout affects ALL E2E tests. The `__test_show_onboarding`
  flag pattern in `navigateAndWait()` provides a clean opt-in/opt-out mechanism without modifying
  individual test files.
- `page.addInitScript()` persists across reloads within the same test, which means scripts added
  in `beforeEach` will re-execute on `page.reload()`. Tests that verify persistence after reload
  must avoid using `addInitScript` to clear state they intend to persist.

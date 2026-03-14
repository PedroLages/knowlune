---
story_id: E10-S01
story_name: "First-Use Onboarding Flow"
status: done
started: 2026-03-14
completed: 2026-03-14
reviewed: true
review_started: 2026-03-14
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 10.1: First-Use Onboarding Flow

## Story

As a first-time user,
I want a guided onboarding flow that walks me through importing a course, starting a study session, and creating a learning challenge,
So that I discover the platform's core value immediately without needing documentation.

## Acceptance Criteria

**Given** I am a new user with no courses imported and no onboarding completion flag in local storage
**When** I land on the dashboard for the first time
**Then** an onboarding overlay appears with a welcome message and a progress indicator showing 3 steps
**And** the first step "Import your first course" is highlighted as active

**Given** the onboarding flow is active on step 1 (Import a course)
**When** I view the prompt
**Then** the relevant UI element for course import is visually highlighted with a spotlight/tooltip
**And** I see a clear call-to-action directing me to the import workflow
**And** a "Skip onboarding" option is visible and accessible

**Given** I have completed step 1 by importing a course
**When** the import finishes successfully
**Then** the onboarding advances to step 2 "Start studying"
**And** the progress indicator updates to show step 2 of 3 as active
**And** the video player or course content area is highlighted with a guiding tooltip

**Given** I have completed step 2 by starting a study session (playing a video for at least 5 seconds)
**When** the session registers
**Then** the onboarding advances to step 3 "Create a learning challenge"
**And** the progress indicator updates to show step 3 of 3 as active
**And** the challenge creation UI element is highlighted with a guiding tooltip

**Given** I have completed step 3 by creating a learning challenge
**When** the challenge is saved
**Then** a congratulatory message appears confirming onboarding is complete
**And** the onboarding completion flag is persisted to local storage
**And** the onboarding overlay dismisses and does not reappear on subsequent visits

**Given** the onboarding flow is active on any step
**When** I click "Skip onboarding"
**Then** the onboarding overlay dismisses immediately
**And** the onboarding completion flag is persisted to local storage
**And** the onboarding does not reappear on subsequent visits

**Given** I previously completed or skipped onboarding
**When** I return to the dashboard
**Then** no onboarding overlay appears
**And** the app loads directly into the normal dashboard view

**Given** the onboarding flow is active
**When** I interact with the highlighted UI element for the current step
**Then** the spotlight follows the element correctly even if the layout shifts or scrolls
**And** the rest of the UI remains accessible but visually de-emphasized

## Tasks / Subtasks

- [x] Task 1: Create `useOnboardingStore` with localStorage persistence (AC: 5,6,7)
- [x] Task 2: Create `OnboardingStep` component — 3 step variants + completion (AC: 1-5)
- [x] Task 3: Create `OnboardingOverlay` with cross-store subscriptions (AC: 3,4,5,8)
- [x] Task 4: Integrate overlay into `Layout.tsx` (AC: 1)
- [x] Task 5: E2E tests — overlay appearance, skip, persistence, CTA nav (AC: all)

## Design Guidance

- Card: `bg-card rounded-[24px] p-8 max-w-md shadow-xl` centered
- Step indicator: pill-shaped dots (active=`bg-brand` wider, done=`bg-success`, future=`bg-muted`)
- Icons: BookOpen/Play/Trophy/PartyPopper from lucide-react
- Completion: canvas-confetti (reuses CompletionModal pattern)
- Animation: motion/react fade+slide-up
- Accessibility: Dialog role, aria-modal, Escape to skip

## Implementation Notes

Architecture: Zustand store + portal overlay. Step detection via cross-store subscriptions (Observer pattern — subjects don't know they're observed).

Files created: `src/stores/useOnboardingStore.ts`, `src/app/components/onboarding/OnboardingOverlay.tsx`, `src/app/components/onboarding/OnboardingStep.tsx`, `tests/e2e/onboarding.spec.ts`

Files modified: `src/app/components/Layout.tsx` (import + render)

## Testing Notes

5 E2E tests: overlay appearance, skip persistence, Escape key, pre-completed state, CTA navigation. All passing on Chromium.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

Reviewed 2026-03-14. Report: `docs/reviews/design/design-review-2026-03-14-e10-s01.md`

**Blockers:** Focus trap missing (B-01) — keyboard users tab out of modal.
**High:** CTA uses `bg-primary` instead of `bg-brand` (H-01), touch targets below 44px (H-02).
**Medium:** `role="presentation"` conflicts with `aria-label` (M-01), Step 3 dismisses before challenge creation (M-02), missing `aria-describedby` (M-03).

## Code Review Feedback

Reviewed 2026-03-14. Report: `docs/reviews/code/code-review-2026-03-14-e10-s01.md`

**High:** Dead `importedAt` in demo-course.ts (H1), hardcoded confetti hex colors (H2), silent `.catch(() => {})` on storage.persist (H3), focus trap missing (H4).
**Medium:** String interpolation instead of `cn()` (M1), `h-w` instead of `size-*` (M2), Step 2 duration subscription may not fire during continuous playback (M3), `directoryHandle` double-cast (M4).

## Web Design Guidelines Review

Reviewed 2026-03-14. Report: `docs/reviews/design/web-design-guidelines-2026-03-14-e10-s01.md`

**Blockers:** No focus trap (B1), no initial focus management (B2).
**High:** Animations ignore `prefers-reduced-motion` (H1).
**Medium:** Step changes not announced via `aria-live` (M1), contradictory `role="presentation"` + `aria-label` (M2), skip button touch target (M3).

## Challenges and Lessons Learned

### Cross-Store Subscriptions (Observer Pattern)
The onboarding overlay needs to detect course imports and study sessions without coupling those features to onboarding logic. Used Zustand `subscribe()` to observe external stores — the subjects (course store, study store) don't know they're being observed. This keeps onboarding self-contained and removable.

### Demo Course Fallback for File System Access API
Browsers without File System Access API (Firefox, WebKit) can't use the file picker for course import. Added a demo course fallback (`src/data/demo-course.ts`) so onboarding step 1 works universally. This also simplifies E2E testing — no need to mock the file system.

### E2E Test Isolation with localStorage
Onboarding state persists in localStorage. Tests must seed `onboarding-completed` flag to prevent the overlay from appearing in non-onboarding specs, and clear it for onboarding-specific tests. Used `page.addInitScript()` for deterministic state before navigation.

### Radix Dialog Over Custom Focus Trap
Initial implementation used a custom overlay div — three independent reviews (design, code, web guidelines) all flagged the missing focus trap as a blocker. Refactoring to Radix Dialog's `<Dialog.Content>` gave focus trapping, Escape-to-close, and `aria-modal` for free. Lesson: reach for Radix primitives first; they solve accessibility problems that custom implementations miss.

### Triple-Review Convergence on Accessibility
The focus trap gap was caught by all three review agents independently. This validated the multi-agent review approach — overlapping coverage on critical accessibility issues means blockers don't slip through even if one agent has a blind spot. Design tokens (`bg-brand` vs `bg-primary`) were also caught consistently across reviewers.

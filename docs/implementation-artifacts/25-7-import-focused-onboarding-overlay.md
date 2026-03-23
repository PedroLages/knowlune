---
story_id: E25-S07
story_name: "Import Focused Onboarding Overlay"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 25.7: Import Focused Onboarding Overlay

## Story

As a first-time user opening Knowlune,
I want a focused onboarding overlay that guides me to import my first course as the single critical action,
So that I immediately see value without being overwhelmed by a multi-step wizard.

## Acceptance Criteria

**AC1: Overlay appears for new users**
**Given** I am a new user with no courses imported and no onboarding completion flag in storage
**When** I land on the app for the first time
**Then** an onboarding overlay appears centered on screen with a welcome message
**And** the overlay has a single call-to-action: "Import Your First Course"
**And** a "Skip" option is clearly accessible

**AC2: Import CTA triggers the import workflow**
**Given** the onboarding overlay is visible
**When** I click "Import Your First Course"
**Then** the overlay dismisses
**And** the file system folder picker opens (or the demo course is imported on unsupported browsers)
**And** on successful import, the onboarding completion flag is persisted to storage

**AC3: Successful import triggers celebration and dismissal**
**Given** I clicked the import CTA from the onboarding overlay
**When** the course import completes successfully
**Then** a brief success toast or celebration animation confirms the import
**And** the onboarding overlay does not reappear on subsequent visits
**And** the newly imported course is visible in the Courses page

**AC4: Skip onboarding persists**
**Given** the onboarding overlay is visible
**When** I click "Skip" or press Escape
**Then** the overlay dismisses immediately
**And** the onboarding completion flag is persisted to storage
**And** the overlay does not reappear on subsequent visits

**AC5: Previously completed users see no overlay**
**Given** I previously completed or skipped the onboarding
**When** I return to the app
**Then** no onboarding overlay appears
**And** the app loads directly into the normal view

**AC6: Accessibility and focus management**
**Given** the onboarding overlay is visible
**When** I use keyboard navigation
**Then** focus is trapped within the overlay (Tab does not escape)
**And** the overlay uses proper dialog semantics (role="dialog", aria-modal)
**And** initial focus is placed on the primary CTA
**And** Escape key dismisses the overlay

**AC7: Responsive design**
**Given** the onboarding overlay is visible
**When** I view on mobile (< 640px), tablet (640-1024px), or desktop (> 1024px)
**Then** the overlay adapts appropriately to each viewport
**And** touch targets are ≥ 44x44px on mobile
**And** content remains readable and actions remain accessible

**AC8: Reduced motion support**
**Given** the user has `prefers-reduced-motion: reduce` enabled
**When** the onboarding overlay appears or dismisses
**Then** animations are disabled or replaced with instant transitions

## Tasks / Subtasks

- [ ] Task 1: Refactor `useOnboardingStore` to support import-focused flow (AC: 1,4,5)
  - [ ] 1.1 Simplify step model (single import step vs 3-step wizard)
  - [ ] 1.2 Add `importTriggeredFromOverlay` flag for celebration tracking
  - [ ] 1.3 Preserve backward-compatible localStorage key
- [ ] Task 2: Rewrite `OnboardingOverlay` as import-focused dialog (AC: 1,2,6,7,8)
  - [ ] 2.1 Use Radix Dialog for focus trap + aria-modal
  - [ ] 2.2 Design single-action layout (welcome + import CTA + skip)
  - [ ] 2.3 Wire import CTA to trigger `importCourseFromFolder()` directly
  - [ ] 2.4 Add `prefers-reduced-motion` support
  - [ ] 2.5 Responsive styling (mobile/tablet/desktop)
- [ ] Task 3: Integrate overlay into Layout.tsx (AC: 1,5)
  - [ ] 3.1 Render `OnboardingOverlay` in Layout
  - [ ] 3.2 Ensure initialization runs on mount
- [ ] Task 4: Handle import success from overlay context (AC: 3)
  - [ ] 4.1 Subscribe to `useCourseImportStore` for import completion
  - [ ] 4.2 Show celebration (confetti or toast) on success
  - [ ] 4.3 Auto-navigate to courses page after import
- [ ] Task 5: E2E tests (AC: all)
  - [ ] 5.1 Overlay appears on fresh state
  - [ ] 5.2 Import CTA triggers folder picker / demo import
  - [ ] 5.3 Skip persists and overlay doesn't reappear
  - [ ] 5.4 Escape key dismisses
  - [ ] 5.5 Previously completed state — no overlay
  - [ ] 5.6 Keyboard focus trap verification

## Design Guidance

**Layout**: Centered modal card (max-w-md), warm background with semi-transparent backdrop.

**Visual hierarchy**:
1. Welcome heading ("Welcome to Knowlune")
2. Brief value proposition (1-2 lines)
3. Hero icon (FolderOpen or BookOpen from lucide-react, in `bg-brand-soft` circle)
4. Primary CTA: `Button variant="brand"` — "Import Your First Course"
5. Secondary action: text link "Skip for now"

**Component**: Use Radix `Dialog` primitive (via shadcn/ui `Dialog` component) for proper focus trap, Escape handling, and aria-modal — fixing the E10-S01 blocker.

**Tokens**: `bg-card`, `rounded-[24px]`, `text-foreground`, `text-muted-foreground`, `bg-brand-soft`, `text-brand`, design token system only.

**Animation**: motion/react fade+scale-up, gated by `prefers-reduced-motion`.

**Responsive**: `p-8` desktop, `p-6` mobile. Full-width on xs screens with `mx-4` margin.

## Implementation Notes

**Plan:** [e25-s07-import-focused-onboarding-overlay.md](plans/e25-s07-import-focused-onboarding-overlay.md)

[Additional notes to be populated during implementation]

## Testing Notes

[To be populated during implementation]

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

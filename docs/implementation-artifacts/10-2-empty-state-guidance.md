---
story_id: E10-S02
story_name: "Empty State Guidance"
status: in-progress
started: 2026-03-14
completed:
reviewed: in-progress
review_started: 2026-03-15
review_gates_passed: []
burn_in_validated: false
---

# Story 10.2: Empty State Guidance

## Story

As a new or returning user viewing a section with no content,
I want contextual empty states that explain what belongs here and link me to the relevant action,
so that I always know my next step and can complete core workflows within 2 minutes without documentation.

## Acceptance Criteria

**Given** I have no courses imported
**When** I view the dashboard overview
**Then** an empty state is displayed with the message "Import your first course to get started"
**And** a prominent call-to-action button links directly to the course import workflow
**And** the empty state includes a supportive illustration or icon that matches the app's visual style

**Given** I have no notes recorded
**When** I view the notes section or notes panel
**Then** an empty state is displayed with the message "Start a video and take your first note"
**And** a call-to-action links to the course library or most recent course so I can begin a session
**And** the empty state briefly describes what notes are for (e.g., "Capture key moments while you study")

**Given** I have no learning challenges created
**When** I view the challenges section
**Then** an empty state is displayed with the message "Create your first learning challenge"
**And** a call-to-action button opens the challenge creation flow directly
**And** the empty state briefly describes the value of challenges

**Given** I have no study sessions recorded
**When** I view the reports or activity section
**Then** an empty state is displayed with a message guiding me to start studying
**And** a call-to-action links to available courses or the course import flow

**Given** any empty state is displayed
**When** I click the call-to-action button
**Then** I am navigated to the correct destination for that action without intermediate steps
**And** the transition completes within 300ms

**Given** I complete the action prompted by an empty state (e.g., import a course)
**When** I return to the previously empty section
**Then** the empty state is replaced with the actual content
**And** no residual empty state messaging is visible

**Given** I am a new user following empty state prompts without any prior training
**When** I complete the sequence of importing a course, starting a study session, and creating a challenge
**Then** the entire sequence is completable within 2 minutes
**And** no external documentation or help pages are required to understand the prompts

## Tasks / Subtasks

- [ ] Task 1: Create reusable EmptyState component (AC: all)
  - [ ] 1.1 Design component with icon/illustration, message, description, and CTA button
  - [ ] 1.2 Support configurable props (icon, title, description, actionLabel, actionHref)
  - [ ] 1.3 Ensure responsive design and accessibility (WCAG 2.1 AA+)
- [ ] Task 2: Add empty state to Dashboard Overview — no courses (AC: 1)
  - [ ] 2.1 Detect zero courses and render empty state
  - [ ] 2.2 CTA links to course import workflow
- [ ] Task 3: Add empty state to Notes section — no notes (AC: 2)
  - [ ] 3.1 Detect zero notes and render empty state
  - [ ] 3.2 CTA links to course library
- [ ] Task 4: Add empty state to Challenges section — no challenges (AC: 3)
  - [ ] 4.1 Detect zero challenges and render empty state
  - [ ] 4.2 CTA opens challenge creation flow
- [ ] Task 5: Add empty state to Reports/Activity — no sessions (AC: 4)
  - [ ] 5.1 Detect zero sessions and render empty state
  - [ ] 5.2 CTA links to courses or import flow
- [ ] Task 6: Verify CTA navigation and content replacement (AC: 5, 6)
  - [ ] 6.1 All CTAs navigate without intermediate steps
  - [ ] 6.2 Empty states replaced by content after action completion
- [ ] Task 7: Validate 2-minute completion flow (AC: 7)

## Design Guidance

### Component Architecture

Create a single reusable `EmptyState` component at `src/app/components/figma/EmptyState.tsx`:

```tsx
interface EmptyStateProps {
  icon: LucideIcon           // Lucide icon component
  title: string              // Primary message (e.g., "Import your first course")
  description?: string       // Secondary explanation text
  actionLabel: string        // CTA button text
  actionHref?: string        // For Link-based navigation
  onAction?: () => void      // For click handlers (dialogs, etc.)
  'data-testid': string      // Required for E2E tests
}
```

### Layout Approach

- **Container**: Centered flex column within the parent section's existing card/container
- **Vertical rhythm**: `gap-4` (16px) between icon → title → description → CTA
- **Max width**: `max-w-sm` (384px) to keep text readable and centered
- **Padding**: `py-12 px-6` for comfortable breathing room inside cards

### Visual Design

- **Icon**: Use Lucide icons at `size={48}` with `text-brand-muted` (`#c8c9e4` light / `#3a3c60` dark). Wrap in a `rounded-full bg-brand-soft p-4` container for visual weight
- **Title**: `font-display text-lg font-medium text-foreground` (Space Grotesk heading font)
- **Description**: `text-sm text-muted-foreground leading-relaxed` (DM Sans body font)
- **CTA Button**: Use shadcn `Button` with `variant="default"` (brand color) and `rounded-xl` per project convention. Include an ArrowRight icon for navigation CTAs

### Design Tokens (no hardcoded colors)

| Element | Token | Purpose |
|---------|-------|---------|
| Icon background | `bg-brand-soft` | Soft brand tint circle |
| Icon color | `text-brand-muted` | Subdued brand icon |
| Title | `text-foreground` | Primary text |
| Description | `text-muted-foreground` | Secondary text |
| CTA background | `bg-brand` / `hover:bg-brand-hover` | Action button |
| CTA text | `text-brand-foreground` | Button text (white) |
| Card background | `bg-card` | Container (inherits) |

### Responsive Strategy

- **Mobile (< 640px)**: Full width, `py-8 px-4`, icon at `size={40}`
- **Tablet (640-1024px)**: Same centered layout, no changes needed
- **Desktop (> 1024px)**: Centered within grid cell, `max-w-sm` keeps it compact

### Accessibility

- Icon is decorative (`aria-hidden="true"`)
- CTA is a `<Button>` or `<Link>` with descriptive text (no "Click here")
- Color contrast: All token pairs meet WCAG 2.1 AA (4.5:1 for text, 3:1 for large)
- Focus ring: Inherits global `focus-visible` ring from theme.css

### Per-Section Specifics

| Section | Icon | Title | Description | CTA | Navigation |
|---------|------|-------|-------------|-----|------------|
| Dashboard (courses) | `BookOpen` | "Import your first course to get started" | "Add a folder with videos, PDFs, or documents" | "Import Course" | Opens import dialog |
| Notes | `FileText` | "Start a video and take your first note" | "Capture key moments while you study" | "Browse Courses" | `/courses` |
| Challenges | `Trophy` | "Create your first learning challenge" | "Set goals and track your progress with timed challenges" | "Create Challenge" | Opens challenge dialog |
| Reports (sessions) | `Clock` | "Start studying to see your analytics" | "Your study time, completion rates, and insights appear here" | "Browse Courses" | `/courses` |

### Motion

Use `motion/react` (already in project) for a subtle fade-up entrance:
- `initial={{ opacity: 0, y: 12 }}` → `animate={{ opacity: 1, y: 0 }}`
- `transition={{ duration: 0.3, ease: 'easeOut' }}`
- Keeps the 300ms transition requirement from AC5

## Implementation Plan

See [plan](plans/e10-s02-empty-state-guidance.md) for implementation approach.

## Implementation Notes

Pending implementation.

## Testing Notes

ATDD tests created in `tests/e2e/story-e10-s02.spec.ts` — 12 failing tests mapping to all 7 ACs.

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

Pending — will be populated by /review-story.

## Code Review Feedback

Pending — will be populated by /review-story.

## Web Design Guidelines Review

Pending — will be populated by /review-story.

## Challenges and Lessons Learned

- Story setup: all dependency epics (1, 3, 4, 6) are done — no blockers
- Codebase already has 3 different empty state patterns (inline HTML, EmptyState component, Empty composables) — standardizing on `EmptyState.tsx` to reduce inconsistency
- Dashboard uses static `allCourses` (always populated) vs. imported courses from Dexie (starts empty) — empty state targets imported courses via `useCourseImportStore`

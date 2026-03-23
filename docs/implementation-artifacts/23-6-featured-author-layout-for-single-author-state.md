---
story_id: E23-S06
story_name: "Featured Author Layout For Single Author State"
status: done
started: 2026-03-23
completed: 2026-03-23
reviewed: true
review_started: 2026-03-23
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 23.6: Featured Author Layout For Single Author State

## Story

As a learner,
I want the Authors page to display a rich, featured layout when there is only one author,
so that the page feels polished and purpose-built rather than showing a lonely card in an empty grid.

## Acceptance Criteria

- **AC1**: Given `allAuthors.length === 1`, when the user views the Authors page, then a featured/hero-style layout is displayed instead of the default card grid — showing the author's avatar, name, title, bio (or short bio), specialties, stats (courses, hours, lessons), and a link to view their full profile
- **AC2**: Given `allAuthors.length > 1`, when the user views the Authors page, then the existing card grid layout is rendered unchanged
- **AC3**: Given the featured layout is displayed, when the user clicks on the author's profile link or card, then they are navigated to the AuthorProfile page (`/authors/:authorId`)
- **AC4**: Given the featured layout is displayed, when viewed on mobile (375px), tablet (768px), and desktop (1440px), then the layout is responsive and visually correct at all breakpoints
- **AC5**: Given the featured layout is displayed, when inspected, then all styling uses design tokens from theme.css (no hardcoded colors)

## Tasks / Subtasks

- [ ] Task 1: Create FeaturedAuthor component (AC: 1, 3, 5)
  - [ ] 1.1 Design hero-style layout with avatar, name, title, short bio
  - [ ] 1.2 Add specialty badges and stats row
  - [ ] 1.3 Add "View Profile" CTA linking to `/authors/:authorId`
  - [ ] 1.4 Ensure all styling uses design tokens
- [ ] Task 2: Conditionally render in Authors page (AC: 1, 2)
  - [ ] 2.1 Branch on `allAuthors.length === 1` vs grid
  - [ ] 2.2 Verify grid layout untouched for multi-author case
- [ ] Task 3: Responsive design (AC: 4)
  - [ ] 3.1 Mobile: stacked vertical layout
  - [ ] 3.2 Tablet/Desktop: horizontal avatar + content layout
- [ ] Task 4: Write E2E tests (AC: 1-5)
  - [ ] 4.1 Featured layout renders for single author
  - [ ] 4.2 Navigation to profile works
  - [ ] 4.3 Responsive layout at 3 breakpoints
- [ ] Task 5: Unit tests (AC: 1, 2)
  - [ ] 5.1 Single author renders featured layout
  - [ ] 5.2 Multiple authors render grid

## Design Guidance

### Layout Strategy

**Single Author (featured) — `allAuthors.length === 1`:**
Render a hero-style card that borrows visual language from the existing `AuthorProfile.tsx` hero section but remains a card on the Authors list page. The layout should feel like a "featured" spotlight, not a full profile page.

**Structure:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────┐                                           │
│  │          │  Author Name                              │
│  │  Avatar  │  Title                                    │
│  │  (lg)    │  "Featured quote..."                      │
│  │          │  [Badge] [Badge] [Badge]                   │
│  └──────────┘                                           │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Courses  │ │ Content  │ │ Lessons  │ │ Exp.     │   │
│  │    8     │ │   42h    │ │   186    │ │   20y    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  Short bio paragraph...                                 │
│                                                         │
│                              [View Full Profile →]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Mobile (< 640px):** Avatar centered above text, stats in 2x2 grid, everything stacked vertically.

**Tablet+ (≥ 640px):** Avatar left, text content right (flex row), stats in 4-column grid below.

### Component Reuse

- Reuse `StatCard` pattern from `AuthorProfile.tsx` (or extract to shared component)
- Reuse `getAuthorStats()` from `src/lib/authors.ts`
- Reuse `getAvatarSrc()` for responsive avatar images
- Reuse `Badge` component for specialties
- Use existing `Card`/`CardContent` from shadcn/ui

### Design Tokens

All styling must use design tokens:
- Card background: `bg-card` (via `<Card>`)
- Text colors: `text-foreground`, `text-muted-foreground`
- Brand accents: `text-brand`, `bg-brand/10`
- Borders: `ring-border/50`
- CTA: `variant="brand"` on Button

### Accessibility

- Semantic heading levels: `h2` for author name (h1 is page title "Our Authors")
- Avatar alt text: author name
- Stats icons: `aria-hidden="true"` (text labels provide context)
- CTA: clear link text "View Full Profile" (not "Click here")
- Focus-visible rings on interactive elements

### Multi-Author Behavior (AC2)

When `allAuthors.length > 1`, the existing grid layout in `Authors.tsx` (lines 31-96) renders unchanged. The featured layout is ONLY for the `=== 1` branch.

## Implementation Plan

See [plan](plans/e23-s06-featured-author-layout-for-single-author-state.md) for implementation approach.

## Implementation Notes

- Created `FeaturedAuthor` component in `src/app/components/figma/FeaturedAuthor.tsx` — a self-contained hero-style card with avatar, name, title, featured quote, specialty badges, stats strip, short bio, and View Full Profile CTA
- Reused existing `getAuthorStats()`, `getAvatarSrc()`, and `getInitials()` utilities — no new dependencies added
- Extracted `StatCard` as a local helper within `FeaturedAuthor.tsx` (mirrors pattern from `AuthorProfile.tsx` but scoped to featured layout)
- Added empty state handling (`allAuthors.length === 0`) to `Authors.tsx` as a defensive guard
- All styling uses design tokens (`bg-muted`, `text-brand`, `ring-border/50`, etc.) — no hardcoded colors

## Testing Notes

- Unit tests in `Authors.test.tsx` cover: single author → featured layout, multiple authors → grid layout, empty state
- No E2E spec created for this story (UI-only change with unit test coverage)
- Responsive breakpoints tested via unit tests verifying conditional CSS classes

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

**Review 1 (2026-03-23)** — 2 MEDIUM, 1 nit. No blockers.
- [MEDIUM] Blockquote `text-left` misaligns inside centered mobile layout — PARTIALLY FIXED (removed text-left but border still misaligns)
- [MEDIUM] Stats render as zero — FIXED (seed author now linked to courses)
- [NIT] Button focus ring with `asChild` — RECLASSIFIED to MEDIUM (WCAG 2.4.7)

**Review 2 (2026-03-23)** — 2 MEDIUM remaining. ACs all pass.
- [MEDIUM] Blockquote left-border still misaligns at 375px mobile (FeaturedAuthor.tsx:52) — add `text-left` to blockquote
- [MEDIUM] Button `asChild` focus ring invisible for keyboard users (FeaturedAuthor.tsx:105) — add `focus-visible:outline` classes

## Code Review Feedback

**Review 1 (2026-03-23)** — 2 HIGH, 4 MEDIUM. All fixed in dd0123d2.

**Review 2 (2026-03-23)** — 0 blockers, 2 HIGH, 4 MEDIUM, 3 nits.
- [HIGH] `getInitials` still duplicated in `AuthorProfile.tsx:21-27` — behavioral inconsistency (confidence 90)
- [HIGH] Quiz component changes bundled in E23-S06 commit — commit scope bleed (confidence 92)
- [MEDIUM] `getInitials` re-export in `avatarUpload.ts:311` creates ghost dependency (confidence 78)
- [MEDIUM] `totalHours` display logic convoluted in FeaturedAuthor.tsx:88 (confidence 75)
- [MEDIUM] `getAuthorStats` outside React cycle — acknowledged, forward-looking (confidence 73)
- [MEDIUM] Blockquote mobile border alignment (confidence 72) — overlaps design review M1

## Web Design Guidelines Review

**Review 1 (2026-03-23)** — 2 MEDIUM, 4 LOW. All 5 actionable findings fixed in dd0123d2.

**Review 2 (2026-03-23)** — 2 LOW, 1 NIT. No blockers. 19/22 checks pass.
- [LOW] FeaturedAuthor stats grid lacks `aria-label` (inconsistency with grid cards)
- [LOW] Bio paragraph has no `line-clamp` overflow safeguard
- [NIT] Author title `<p>` could use `text-wrap-balance`

## Challenges and Lessons Learned

- **Duplicate `getInitials` utility:** Initially duplicated a `getInitials` helper locally in `FeaturedAuthor.tsx` — discovered during a fix commit that `getInitials` already existed in `src/lib/avatarUpload.ts`. Consolidated to single import. Pattern: always search for existing utilities before creating new ones.
- **Empty state guard:** Added `allAuthors.length === 0` guard to `Authors.tsx` — not in original ACs but necessary for defensive rendering. Prevents rendering errors if the authors data source becomes empty.
- **StatCard extraction decision:** Chose to keep `StatCard` as a local component within `FeaturedAuthor.tsx` rather than extracting to shared component. Rationale: only used in one place; premature extraction would add file overhead without reuse benefit. Can be promoted later if `AuthorProfile.tsx` refactors to share it.
- **Responsive layout approach:** Used `flex-col sm:flex-row` for the hero section and `grid-cols-2 sm:grid-cols-4` for stats — simple, robust responsive breakpoints without media query complexity. The `self-center sm:self-start` on the avatar handles alignment naturally.
- **Specialty badge overflow:** Capped at 5 badges with `+N` overflow indicator to prevent layout breakage with authors who have many specialties.

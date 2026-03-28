---
story_id: E51-S04
story_name: "Spacious Content Density Mode"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 51.4: Spacious Content Density Mode

## Story

As a learner who prefers spacious layouts,
I want to increase spacing in content areas,
so that I can read with more whitespace and less visual crowding.

## Acceptance Criteria

**Given** the density toggle is OFF (default)
**When** the user enables spacious mode
**Then** `<html>` gets class `.spacious` and content area padding, gaps, and line-height increase immediately

**Given** spacious mode is ON
**When** the user disables it
**Then** `.spacious` class is removed and spacing reverts to default

**Given** spacious mode is ON
**When** viewing the sidebar and header
**Then** they remain unchanged (no extra spacing)

**Given** spacious mode is ON
**When** viewing the Overview page grid layout
**Then** card gaps widen from 1.5rem to 2rem

**Given** spacious mode is ON
**When** viewing the Reports table
**Then** cell padding increases from 0.75rem to 1rem

**Given** the density preference is saved
**When** the page is reloaded
**Then** spacious mode is re-applied on init without layout flash

## Tasks / Subtasks

- [ ] Task 1: Add content density CSS tokens to theme.css (AC: 1, 4, 5)
  - [ ] 1.1 Open `src/styles/theme.css`
  - [ ] 1.2 Add to `:root` block (after existing variables, before `.dark` block):
    ```css
    /* Content density tokens (E51) */
    --content-padding: 1rem;
    --content-gap: 1.5rem;
    --content-line-height: 1.6;
    --table-cell-padding: 0.75rem;
    ```
  - [ ] 1.3 Add `.spacious` override (after `.vibrant` block, as a new block):
    ```css
    html.spacious {
      --content-padding: 1.25rem;
      --content-gap: 2rem;
      --content-line-height: 1.8;
      --table-cell-padding: 1rem;
    }
    ```

- [ ] Task 2: Create `useContentDensity` hook (AC: 1, 2, 6)
  - [ ] 2.1 Create `src/hooks/useContentDensity.ts`
  - [ ] 2.2 Read `contentDensity` from `getSettings()` on mount
  - [ ] 2.3 Listen for `settingsUpdated` events (follow `useColorScheme.ts` pattern exactly)
  - [ ] 2.4 useEffect: toggle `.spacious` class on `document.documentElement` based on `contentDensity === 'spacious'`
  - [ ] 2.5 Clean up event listeners on unmount

- [ ] Task 3: Wire hook into App.tsx (AC: 6)
  - [ ] 3.1 Import `useContentDensity` from `@/hooks/useContentDensity`
  - [ ] 3.2 Call `useContentDensity()` alongside existing hooks in App component

- [ ] Task 4: Update content-area components to use density tokens (AC: 1, 3, 4, 5)
  - [ ] 4.1 Audit content-area components (NOT sidebar, NOT header, NOT modals)
  - [ ] 4.2 Update page-level grid gaps in `src/app/pages/Overview.tsx`: replace hardcoded `gap-6` with `gap-[var(--content-gap)]` where it controls main content grid
  - [ ] 4.3 Update page-level grid gaps in `src/app/pages/Courses.tsx`: replace `gap-6` with `gap-[var(--content-gap)]` for course card grid
  - [ ] 4.4 Update page-level grid gaps in `src/app/pages/MyClass.tsx`: replace `gap-6` with `gap-[var(--content-gap)]` for content grid
  - [ ] 4.5 Update Card content padding in content area cards: replace `p-4`/`p-6` with `p-[var(--content-padding)]` on highest-impact cards
  - [ ] 4.6 Update table cell padding in `src/app/pages/Reports.tsx`: replace `p-3` with `p-[var(--table-cell-padding)]` for data table cells
  - [ ] 4.7 Apply `leading-[var(--content-line-height)]` to main content text areas (prose paragraphs, card descriptions)
  - [ ] 4.8 Verify sidebar (`Layout.tsx` sidebar section) is NOT touched
  - [ ] 4.9 Verify header is NOT touched
  - [ ] 4.10 Target 10-15 component touch points across content area

- [ ] Task 5: Add density toggle to DisplayAccessibilitySection (AC: 1, 2)
  - [ ] 5.1 Open `src/app/components/settings/DisplayAccessibilitySection.tsx`
  - [ ] 5.2 Replace the Density subsection placeholder with:
    - Label: "Spacious Mode"
    - Description: "Increase spacing in content areas for easier reading"
    - `<Switch>` bound to `settings.contentDensity === 'spacious'`
    - `aria-label="Enable spacious content density"`
  - [ ] 5.3 On change: call `onSettingsChange({ contentDensity: settings.contentDensity === 'spacious' ? 'default' : 'spacious' })`

## Design Guidance

- **Switch row layout:** Same as font toggle -- label + description on left, Switch on right
- **Mobile:** Stacks on <640px via `flex flex-col sm:flex-row`
- **Content density scope:** ONLY content area -- never touch sidebar padding, header padding, or modal padding
- **CSS variable usage:** Use `var(--content-gap)` etc. in Tailwind via arbitrary value syntax: `gap-[var(--content-gap)]`
- **All colors must use design tokens** -- no hardcoded Tailwind colors

## Implementation Notes

- **CSS class toggle pattern:** Follow `src/hooks/useColorScheme.ts` -- adds/removes class on `document.documentElement`
- **Theme.css pattern:** New `.spacious` block follows exact pattern of `.dark` and `.vibrant` blocks in `src/styles/theme.css`
- **Density token retrofitting risk:** Updating 10-15 components to use CSS variable tokens has risk of visual regressions. Mitigate with visual QA across all pages. Start with highest-impact areas (page-level grids, card padding in Overview/Courses).
- **Sidebar/header exclusion:** Only touch components rendered inside the `<Outlet />` in `Layout.tsx`. The sidebar navigation and top header must remain unchanged.
- **Files modified:** `src/styles/theme.css`, `src/hooks/useContentDensity.ts` (new), `src/app/App.tsx`, `src/app/components/settings/DisplayAccessibilitySection.tsx`, `src/app/pages/Overview.tsx`, `src/app/pages/Courses.tsx`, `src/app/pages/MyClass.tsx`, `src/app/pages/Reports.tsx` + ~5-10 content-area component files
- **No new dependencies required**

## Testing Notes

- **Unit tests (Vitest):**
  - `useContentDensity`: test `.spacious` class added to `documentElement` when setting is `'spacious'`
  - `useContentDensity`: test `.spacious` class removed when setting is `'default'`
  - `useContentDensity`: test event listener cleanup on unmount
- **E2E tests (Playwright):** `tests/e51-s04-content-density.spec.ts`
  - Toggle spacious ON -> verify `.spacious` class on `<html>`
  - Toggle spacious OFF -> verify no `.spacious` class
  - Verify Overview page: `--content-gap` computed value changes from 1.5rem to 2rem when spacious
  - Verify Reports table: `--table-cell-padding` computed value changes from 0.75rem to 1rem when spacious
  - Verify sidebar padding does NOT change when spacious is toggled
  - Verify header padding does NOT change when spacious is toggled
  - Reload page with spacious enabled -> verify `.spacious` class re-applied
- **Visual QA (manual):**
  - Review all 6 pages (Overview, My Class, Courses, Authors, Reports, Settings) with spacious mode ON
  - Verify no layout breakage or overflow issues
  - Verify sidebar and header remain stable

## Dependencies

- **Depends on:** E51-S01 (AppSettings fields + DisplayAccessibilitySection shell)
- **Can parallel with:** E51-S02, E51-S03

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]

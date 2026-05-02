# E66-S02: Target Size Audit and Fixes (WCAG 2.5.8) — Requirements

**Story:** [E66-S02-target-size-audit.md](../implementation-artifacts/stories/E66-S02-target-size-audit.md)
**Date:** 2026-04-25
**Type:** Accessibility audit + fixes

## Problem Statement

Knowlune must conform to WCAG 2.5.8 Target Size (Minimum) AA: every interactive
element either renders at >= 24x24 CSS pixels or sits >= 24px from any other
interactive neighbor. Without an automated audit and verified fixes, dense UI
areas (tag chips, table actions, close icons) silently regress and block users
with motor impairments.

## Goals

1. Land an automated Playwright audit that fails CI when any in-scope element
   violates the 24px rule and lacks the spacing exception.
2. Catalog every violation across the app's user-facing routes.
3. Fix violations by enlarging click targets via padding (no visual regressions)
   or by enforcing the 24px spacing exception.
4. Document quiz option buttons (44px standard) as compliant baseline.

## Non-Goals

- Visual redesign of any component.
- Mobile-only target size changes outside the WCAG floor.
- Changing the 44x44 Knowlune standard for primary CTAs.
- Auditing browser-controlled native UI (`<select>` dropdown chrome, date
  picker popovers).

## Acceptance Criteria (from story)

1. All interactive targets >= 24x24 CSS pixels OR >= 24px spacing exception.
2. Dense UI areas (table actions, tag chips, inline links) audited and fixed.
3. Quiz option buttons documented as already meeting 44x44 (Knowlune standard).
4. TopicFilter chips >= 24px tall with 24px horizontal spacing.
5. Small icon buttons have >= 24x24 click area via padding.
6. E2E audit test reports any in-scope element below 24x24 with spacing < 24px.

## In-Scope Selectors

`button`, `a[href]`, `[role="button"]`, `input` (excluding hidden), `select`,
`[role="checkbox"]`, `[role="switch"]`, `[role="slider"]`.

## Out-of-Scope / Exclusions

- Inline links inside paragraph text (`<p> a`).
- Native browser-controlled UI (date pickers, `<select>` dropdown chrome).
- Elements where size is essential to information conveyed (per WCAG).
- Elements with `display: none` or `visibility: hidden`.

## Routes Under Audit

Overview, MyClass, Courses, CourseDetail, Authors, AuthorProfile, Reports,
Settings, LearningPaths, LearningPathDetail, Notes, Quiz, Flashcards,
Challenges, Login.

## Likely Hotspots

- `src/app/components/figma/TopicFilter.tsx`
- `src/app/components/figma/TagBadgeList.tsx`
- `src/app/components/figma/TagEditor.tsx`
- `src/app/components/figma/TagManagementPanel.tsx`
- `src/app/components/figma/StatusFilter.tsx`
- Quiz grids: `QuestionGrid.tsx`, `ReviewQuestionGrid.tsx`, `QuestionBreakdown.tsx`
- Dialog/Sheet close buttons (verify shadcn defaults)

## Fix Strategy

- Prefer invisible padding via `min-w-6 min-h-6` (24px) on icon buttons.
- Use `Button` `size="icon"` (36x36) where a Button is appropriate.
- Apply 24px gap (`gap-6`) between chip neighbors when chip size is < 24px.
- Never alter visual sizing of elements that already feel right — expand the
  click area via padding only.

## Dependencies

- WCAG 2.1 AA reference (2.5.8).
- Existing Playwright + IDB seeding helpers (`tests/audit/` may not exist yet —
  create directory if needed).
- No new runtime dependencies; only test-side audit code.

## Test Plan

- New spec: `tests/audit/target-size.spec.ts`.
- Run on desktop (1280x720) and mobile (375x667) viewports.
- Use Playwright's element-array selector helper to collect bounding boxes;
  cross-check spacing exception by computing distance to nearest interactive
  sibling.
- Assert violation list is empty after fixes; failures print page, selector,
  size, and nearest-neighbor distance.

## Risks

- Padding changes accidentally shift surrounding layout — mitigate by using
  `min-w/min-h` rather than fixed padding bumps where possible.
- Audit becomes flaky on dynamic-height content — wait for `networkidle` or a
  stable hydration signal before measuring.
- False positives from inline links inside prose — exclusion filter must
  detect `a` whose closest interactive ancestor is a `<p>` / paragraph block.

## Definition of Done

- Audit spec passes on every in-scope route, both viewports.
- Catalog of original findings recorded in story Lessons section.
- All identified violations fixed (or explicitly exempted with rationale).
- `npm run build`, `npm run lint`, `npx tsc --noEmit` all green.
- PR merged to main; sprint-status set to `done`.

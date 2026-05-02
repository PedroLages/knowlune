---
title: "feat(E66-S02): Target Size Audit and Fixes (WCAG 2.5.8)"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-e66-s02-target-size-audit-requirements.md
---

# feat(E66-S02): Target Size Audit and Fixes (WCAG 2.5.8)

## Overview

Land an automated Playwright audit that enforces WCAG 2.5.8 (Target Size,
Minimum) across Knowlune's interactive surfaces, then fix every violation it
surfaces. Targets must be at least 24x24 CSS pixels OR have at least 24 px
spacing from the nearest interactive neighbor (the WCAG spacing exception).

## Problem Frame

Users with motor impairments (tremors, low-precision pointers, touch on small
screens) miss-tap controls when they fall below the 24 px floor. Knowlune has
no automated regression guard for target size today, and dense components such
as `TopicFilter`, `TagBadgeList`, `StatusFilter`, and quiz number grids are
likely below the floor in places. A reusable audit + a one-shot fix sweep gives
us both AA compliance and a regression net.

## Requirements Trace

- R1. All interactive targets >= 24x24 CSS px OR satisfy the 24 px spacing exception (story AC 1).
- R2. Dense UI areas (table actions, tag chips, inline links) audited and fixed (AC 2).
- R3. Quiz option buttons documented as already meeting Knowlune's 44x44 standard (AC 3).
- R4. `TopicFilter` chips at least 24 px tall with 24 px horizontal spacing (AC 4).
- R5. Small icon buttons expand to 24x24 click area via padding (AC 5).
- R6. E2E audit reports any in-scope element below 24x24 with spacing < 24 px (AC 6).

## Scope Boundaries

- No visual redesign — fixes use invisible padding / `min-w-*` / `min-h-*` only.
- Knowlune's existing 44x44 standard for primary CTAs is preserved, not lowered.
- No mobile-only changes outside the WCAG floor.
- No native browser-controlled UI (`<select>` chrome, native date pickers).

### Deferred to Separate Tasks

- Adding the audit to the CI workflow file: handled by the existing
  `playwright.config.ts` test discovery — covered here. CI YAML edits, if any,
  are out of scope for this story.

## Context & Research

### Relevant Code and Patterns

- Existing accessibility specs to mirror layout/style:
  - `tests/e2e/accessibility-overview.spec.ts`
  - `tests/e2e/accessibility-courses.spec.ts`
  - `tests/e2e/accessibility-navigation.spec.ts`
- Hotspot components:
  - `src/app/components/figma/TopicFilter.tsx`
  - `src/app/components/figma/TagBadgeList.tsx`
  - `src/app/components/figma/TagEditor.tsx`
  - `src/app/components/figma/TagManagementPanel.tsx`
  - `src/app/components/figma/StatusFilter.tsx`
- Quiz / question grids (verify, likely already 44 px): `src/app/pages/Quiz.tsx`,
  any `QuestionGrid.tsx` / `ReviewQuestionGrid.tsx` / `QuestionBreakdown.tsx`
  if present.
- Shared Button variants: `src/app/components/ui/button.tsx` — `size="icon"`
  (36x36) is compliant; reuse where appropriate.
- Playwright config: `playwright.config.ts` discovers everything under `tests/`
  by default — placing the spec at `tests/audit/target-size.spec.ts` will run
  in the existing `chromium` (and other configured) projects without config
  changes.

### Institutional Learnings

- `.claude/rules/styling.md`: prefer Tailwind `min-w-6 min-h-6` (24 px) /
  `min-w-11 min-h-11` (44 px). Never hardcode colors; use design tokens.
- `.claude/rules/testing/test-patterns.md`: deterministic time, IDB seeding
  helpers, no `waitForTimeout` without justification.
- Worktree warning in `CLAUDE.md`: kill stale dev servers on port 5173 before
  E2E runs.

### External References

- WCAG 2.1 SC 2.5.8 Target Size (Minimum), AA — bounding-box rule + spacing
  exception + inline-text exception.

## Key Technical Decisions

- **Audit lives under `tests/audit/`** (new directory), discovered automatically
  by `playwright.config.ts`. Keeps it separate from `tests/e2e/` to avoid
  visual confusion with feature specs while still running in the standard CI
  path.
- **Two viewports per route**: desktop (1280x720) and mobile (375x667). Some
  components only collapse on mobile; running both surfaces real risk.
- **Bounding box from Playwright**: collect rects via the page-side selector
  helper; compute spacing in Node-side test code rather than in the page to
  keep the logic reviewable and testable.
- **Spacing exception math**: a violation is reported only when both
  `width < 24 OR height < 24` AND the L-infinity distance to the nearest
  interactive neighbor's rect is `< 24` px (matches WCAG language: "the target
  is in a sentence" or has 24 px clear space).
- **Exclusions are explicit**: inline `<a>` whose nearest block ancestor is a
  `<p>`, elements with `display: none` / `visibility: hidden` / zero rect,
  native `<select>` chrome, and `<input type="hidden">`.
- **Fix strategy**: prefer `min-w-6 min-h-6` + adequate `p-*` so visual size is
  unchanged. Never increase the rendered glyph size unless it already feels
  off.
- **Routes covered**: every route reachable without auth in the seeded fixture
  set. Auth-gated routes (Quiz, Flashcards, etc.) use the existing IDB seeding
  helpers from `tests/helpers/`.

## Open Questions

### Resolved During Planning

- **Where to place the audit?** `tests/audit/target-size.spec.ts` — picked up
  by default Playwright discovery; no config edits required.
- **How to handle auth-gated routes?** Reuse `tests/helpers/seedSearchFrecency.ts`
  patterns and the existing dismiss-onboarding helper to land on each route
  with deterministic state.
- **Pass criterion for first run?** Catalog mode: spec runs in `--reporter=list`
  printing every violation but the test asserts only after fixes (Unit 7).
  This avoids a giant first-PR red wave.

### Deferred to Implementation

- Exact selector list of small icon buttons that need padding bumps —
  discovered by running Unit 1 + Unit 2 against current `main`.
- Whether any ShadCN primitive already has a 24 px floor we missed — verified
  by inspection during Unit 4.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for
> review, not implementation specification.*

```
For each route in ROUTES:
  For each viewport in [desktop, mobile]:
    page.goto(route)
    elements = page.$$(INTERACTIVE_SELECTOR)
    rects = elements.map(boundingBox + tag + selectorHint + isExcluded?)
    violations = rects.filter(r =>
      !r.excluded &&
      (r.width < 24 || r.height < 24) &&
      minNeighborDistance(r, rects) < 24
    )
    report(route, viewport, violations)
    expect(violations).toEqual([])   // gated on, post-fix
```

`INTERACTIVE_SELECTOR`:
`button, a[href], [role="button"], [role="checkbox"], [role="switch"], [role="slider"], input:not([type="hidden"]), select`

Exclusion predicate:
- inline `<a>` inside `<p>`
- zero-area or hidden rect (display:none / visibility:hidden / aria-hidden)
- native `<select>` (browser controls dropdown chrome)

## Implementation Units

- [ ] **Unit 1: Audit harness scaffold**

**Goal:** Build the reusable measurement + violation-detection helper used by
the spec. No route iteration yet — pure logic that turns a list of rects into a
violation list.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Create: `tests/audit/target-size-helpers.ts`
- Test: covered indirectly by Unit 2 spec

**Approach:**
- Export `INTERACTIVE_SELECTOR` constant.
- Export `collectInteractiveRects(page)` returning
  `{ selector, tag, role, width, height, x, y, excluded, excludeReason }[]`.
- Export `findViolations(rects)` applying the 24 px + spacing rule.
- Exclusion logic: check ancestor chain for `<p>` (inline link), check
  computed style (`display`, `visibility`), check tag === `select`, check
  `aria-hidden="true"`.

**Patterns to follow:**
- Helpers under `tests/helpers/` for module shape.
- Avoid `Date.now()` / `new Date()` per ESLint rule.

**Test scenarios:**
- Happy path: two non-overlapping 20x20 rects > 24 px apart → both flagged
  (size violation, spacing exception not met).
- Edge case: 20x20 rect with neighbor at 25 px distance → not flagged
  (spacing exception satisfied).
- Edge case: 24x24 rect → not flagged (at threshold).
- Edge case: rect with `width=0, height=0` → excluded.
- Error path: rect with no neighbors at all → flagged if < 24 (no exception
  applies).
- Edge case: inline `<a>` whose nearest block ancestor is `<p>` → excluded.

**Verification:**
- Helper is unit-testable with synthetic rect arrays; no DOM required.

- [ ] **Unit 2: Target-size audit spec (catalog mode)**

**Goal:** Run the harness across every in-scope route on desktop + mobile,
print findings, but do not yet fail the build.

**Requirements:** R6, R1

**Dependencies:** Unit 1

**Files:**
- Create: `tests/audit/target-size.spec.ts`

**Approach:**
- Define `ROUTES` array. Auth-gated routes use existing helpers
  (`tests/helpers/dismiss-onboarding.ts`, IDB seeding) to land logged-in.
- For each `(route, viewport)` pair, navigate, wait for `networkidle`, run
  `collectInteractiveRects` + `findViolations`.
- Print a structured report: `route | viewport | selector | size | nearest`.
- Initially `test.fixme()` the assertion so CI still passes during catalog
  phase. Removed in Unit 7.

**Patterns to follow:**
- `tests/e2e/accessibility-overview.spec.ts` for setup shape.
- `tests/e2e/auth-flow.spec.ts` for auth seeding if needed.

**Test scenarios:**
- Happy path: spec runs against `main` and prints a non-empty catalog without
  failing CI.
- Integration: each viewport switch reuses the page (resize) — verify no
  cross-route state leak by asserting URL after each goto.

**Verification:**
- Running `npx playwright test tests/audit/target-size.spec.ts` produces a
  JSON-ish report saved to `test-results/target-size-catalog.json` (or
  console output if simpler).

- [ ] **Unit 3: Fix `TopicFilter` chips**

**Goal:** Ensure every chip is >= 24 px tall with >= 24 px horizontal spacing
between chips.

**Requirements:** R4

**Dependencies:** Unit 2 catalog confirms violation (or eyeballing).

**Files:**
- Modify: `src/app/components/figma/TopicFilter.tsx`

**Approach:**
- Add `min-h-6` to each chip.
- Verify gap utility (`gap-2` / `gap-3`) — keep it but add per-chip horizontal
  padding so the click area >= 24 px wide. If chip is `< 24` wide visually,
  apply `min-w-6` and adjust `px-*`.
- No color changes.

**Patterns to follow:**
- ShadCN `Badge` / `Button size="sm"` sizing for reference.

**Test scenarios:**
- Happy path: rendered `TopicFilter` chips report >= 24x24 px in audit on
  both desktop and mobile.

**Verification:**
- Audit run with route covering `TopicFilter` shows zero chip violations.

- [ ] **Unit 4: Fix small icon buttons**

**Goal:** All bare icon buttons (close X, table actions, tag-remove buttons,
inline filter affordances) have >= 24x24 click area.

**Requirements:** R2, R5

**Dependencies:** Unit 2 catalog (drives the exact list).

**Files:**
- Modify (as catalog dictates):
  - `src/app/components/figma/TagBadgeList.tsx`
  - `src/app/components/figma/TagEditor.tsx`
  - `src/app/components/figma/TagManagementPanel.tsx`
  - `src/app/components/figma/StatusFilter.tsx`
  - Any other component flagged by Unit 2.

**Approach:**
- Prefer adding `min-w-6 min-h-6` + sufficient padding so the visual icon
  glyph (often 12-16 px) is centered in a 24 px hit target.
- Where the element should look like a Button, swap to `<Button size="icon">`
  (36x36, already compliant).
- No design-token / color changes.

**Patterns to follow:**
- `src/app/components/ui/button.tsx` `size="icon"` variant.
- Existing `aria-label` patterns must be preserved on icon-only buttons.

**Test scenarios:**
- Happy path: each fixed component appears in audit at >= 24x24 on both
  viewports.
- Edge case: confirm `aria-label` still present after refactor.

**Verification:**
- Audit run reports zero violations from the fixed components.

- [ ] **Unit 5: Quiz option button compliance check (documentation only)**

**Goal:** Confirm quiz option buttons already meet 44x44 and document.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `docs/implementation-artifacts/stories/E66-S02-target-size-audit.md`
  (Lessons section).
- Inspect: `src/app/pages/Quiz.tsx`.

**Approach:**
- Read current quiz button classes; if `min-h-11` (44 px) or larger, document
  as compliant. If not, add `min-h-11`.
- Note compliance baseline in story Lessons section.

**Test scenarios:**
- Test expectation: none — documentation + verification only. Audit (Unit 7)
  will confirm.

**Verification:**
- Story file updated with compliance note. Audit shows zero quiz-option
  violations.

- [ ] **Unit 6: Sweep remaining catalog violations**

**Goal:** Apply the same padding strategy to any remaining flagged elements
not covered by Units 3-5 (close buttons, dialog/sheet primitives, misc.).

**Requirements:** R1, R2

**Dependencies:** Unit 2 catalog

**Files:**
- Modify: as dictated by remaining catalog entries.

**Approach:**
- Per element: prefer padding via `min-w-* min-h-*`; verify ARIA labels
  preserved; no visual style changes.
- For ShadCN primitives (`DialogClose`, `SheetClose`), wrap or override only
  if the default is below 24 px; document if compliant.

**Test scenarios:**
- Happy path: every remaining catalog entry resolved or explicitly excluded
  with rationale committed in the spec's exclusion list.

**Verification:**
- Re-running the audit shows an empty violation list across all routes /
  viewports.

- [ ] **Unit 7: Flip audit to enforcing mode**

**Goal:** Remove the `test.fixme` from Unit 2 so the audit fails CI on
regression.

**Requirements:** R1, R6

**Dependencies:** Units 3-6

**Files:**
- Modify: `tests/audit/target-size.spec.ts`

**Approach:**
- Replace `test.fixme(...)` with `expect(violations).toEqual([])` and a
  helpful failure message that prints the violation table.
- Keep an explicit, commented exclusion list (e.g., known third-party widget
  IDs) — empty by default.

**Test scenarios:**
- Happy path: audit passes on `main` after fixes.
- Regression check: temporarily shrink one chip locally → audit fails with a
  readable message.

**Verification:**
- `npx playwright test tests/audit/target-size.spec.ts` exits 0.
- `npm run build`, `npm run lint`, `npx tsc --noEmit` all green.

## System-Wide Impact

- **Interaction graph:** No runtime callbacks/middleware affected; CSS-only
  changes plus a new test file.
- **Error propagation:** N/A — test file failure path only.
- **State lifecycle risks:** None. Audit reads DOM after `networkidle`; does
  not mutate persistent state.
- **API surface parity:** No public API changes.
- **Integration coverage:** Audit itself is the cross-layer guard; runs in the
  standard Playwright project.
- **Unchanged invariants:** Visual design unchanged. No design-token /
  color / typography modifications. Knowlune's 44 px standard for primary
  CTAs preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Padding bumps shift surrounding layout | Use `min-w-* / min-h-*` rather than enlarging `px-*` / `py-*` where possible; visually verify each fix. |
| Audit becomes flaky on dynamic-height content | `await page.waitForLoadState('networkidle')` before measuring; consider an additional explicit hydration wait if needed. |
| Inline-link false positives | Explicit `<p>` ancestor exclusion; add a documented exclusion list for any remaining edge cases. |
| Auth-gated routes block measurement | Reuse existing IDB seeding helpers; if a route can't be seeded deterministically, exclude with a documented reason. |
| Catalog reveals far more violations than estimated | Unit 6 absorbs the long tail; if scope explodes, split into a follow-up story rather than blocking this PR. |

## Documentation / Operational Notes

- Update story Lessons section with: original violation count, list of
  components touched, any explicit exclusions and rationale.
- No runtime feature flag, no rollout, no migration.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-25-e66-s02-target-size-audit-requirements.md](../brainstorms/2026-04-25-e66-s02-target-size-audit-requirements.md)
- **Story:** [docs/implementation-artifacts/stories/E66-S02-target-size-audit.md](../implementation-artifacts/stories/E66-S02-target-size-audit.md)
- Related code: `src/app/components/figma/TopicFilter.tsx`,
  `src/app/components/ui/button.tsx`, `tests/e2e/accessibility-*.spec.ts`
- Project rules: `.claude/rules/styling.md`,
  `.claude/rules/testing/test-patterns.md`
- WCAG 2.1: Success Criterion 2.5.8 Target Size (Minimum)

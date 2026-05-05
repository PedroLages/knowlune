---
title: "refactor: CourseOverview timeline node indicators"
type: refactor
status: active
date: 2026-05-05
---

# refactor: CourseOverview timeline node indicators

## Summary

Replace the current “timeline dots” on the course detail page (`/courses/:courseId`) with Apple-style node indicators (completed check, current ring+dot, neutral outline for upcoming) adapted to Knowlune’s theme tokens, without changing navigation or progress semantics.

---

## Requirements

- R1. The timeline node indicator must support three visual states mapped from existing module status logic: **completed**, **active/current**, and **upcoming**.
- R2. The indicator must use Knowlune theme tokens (including `.apple` scheme) and render correctly in light/dark.
- R3. The change must not regress existing “Course Journey” layout or interactions (module expand/collapse and lesson links).

---

## Scope Boundaries

- No changes to how module status is computed (still driven by `moduleStatuses` in `CourseOverview.tsx`).
- No behavioral gating/locking of modules or lessons (visual-only indicator change).
- No redesign of the module cards, lesson rows, or sidebar.

### Deferred to Follow-Up Work

- If the product later introduces true “locked” progression gating, revisit “upcoming” semantics so the lock icon reflects actual access rules (not just “not started yet”).

---

## Context & Research

### Relevant Code and Patterns

- Timeline rendering and current dot implementation lives in `src/app/pages/CourseOverview.tsx` under the “Course Journey” section (the `/* Timeline dot */` block inside the curriculum map).
- Theme tokens (including `.apple`) are defined in `src/styles/theme.css`. Relevant tokens for this work:
  - `--brand` / `--brand-hover` (Apple Action Blue in `.apple`)
  - `--success` / `--success-foreground`
  - `--muted-foreground`, `--border`, `--background`, `--card`
  - `--ring` / `--focus-ring`

### External References

- Provided HTML reference (node indicator shapes + states): completed check in filled circle, current ring with inner dot, muted third node. Implementation uses a **neutral circle** for upcoming (not a lock) so it does not imply gated access until product adds real progression locks.

### Note on ce-plan reference docs

The `ce-plan` skill references internal helper docs (e.g. `references/synthesis-summary.md`) that were not found in this repo checkout. This plan follows the core `ce-plan` structure and portability rules (repo-relative paths, implementation units with tests) without those helper docs.

---

## Key Technical Decisions

- **Extract indicator to a small component**: Create a `CourseJourneyNodeIndicator` (or similarly named) component so the page JSX stays readable and the 3-state mapping is centralized.
- **State mapping (visual-only)**:
  - `completed` → filled circle using `success` token + check icon
  - `active` → white/transparent circle with `brand` ring + inner `brand` dot
  - `upcoming` → muted circle with subtle ring + outline circle icon (muted) — avoids lock semantics without real gating
- **Token-first styling**: Prefer Tailwind classes that resolve to CSS variables (`text-brand`, `bg-success`, `border-border`, `bg-card`, etc.) so the indicator automatically adapts across schemes (`default`, `clean`, `vibrant`, `apple`) and dark mode.

---

## Open Questions

### Deferred to Implementation

- Resolved: `upcoming` uses the same neutral circle on all breakpoints (no lock affordance).

---

## Implementation Units

- U1. **Add reusable node-indicator component**

**Goal:** Provide a single, theme-aware implementation of the 3 node states that matches the provided HTML indicator shapes.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `src/app/components/course/CourseJourneyNodeIndicator.tsx`
- Modify: `src/app/pages/CourseOverview.tsx`
- Test: `src/app/components/course/__tests__/CourseJourneyNodeIndicator.test.tsx`

**Approach:**
- Define a small prop-driven API, e.g. `status: 'completed' | 'active' | 'upcoming'` and `size?: 'sm' | 'md'` (optional).
- Render three variants:
  - completed: filled circle + check icon
  - active: outer ring + inner dot
  - upcoming: muted circle + outline circle icon
- Ensure icon choice matches existing icon set (Lucide is already used in `CourseOverview.tsx`), and that icons inherit correct foreground color via tokens.

**Patterns to follow:**
- Tailwind token usage in `src/styles/theme.css` (e.g. `bg-card`, `text-brand`, `bg-success`).
- Component placement pattern in `src/app/components/course/`.

**Test scenarios:**
- Happy path: given `status="completed"`, renders a filled circle and a check icon with accessible-hidden semantics (icon aria-hidden, wrapper not announcing decorative content).
- Happy path: given `status="active"`, renders an outer ring and an inner dot (two distinct elements) with `brand`-colored styling.
- Happy path: given `status="upcoming"`, renders outline circle icon and muted container styling.
- Edge case: unknown/undefined status is impossible at type-level; ensure TypeScript enforces exhaustiveness (switch/never) in implementation.

**Verification:**
- The component visually matches the HTML reference shapes when used in `CourseOverview` (completed/current/upcoming), and inherits theme colors in `.apple` scheme.

---

- U2. **Replace CourseOverview “Timeline dot” with new indicator**

**Goal:** Swap the inline “dot” JSX block for the reusable indicator while preserving layout (absolute positioning on the rail) and current module card behavior.

**Requirements:** R1, R3

**Dependencies:** U1

**Files:**
- Modify: `src/app/pages/CourseOverview.tsx`
- Test: `tests/e2e/regression/course-overview.spec.ts` (only if the suite asserts dot semantics; otherwise add a small targeted assertion)

**Approach:**
- Replace the `/* Timeline dot */` `div` with `CourseJourneyNodeIndicator` and keep the same absolute positioning (`-left`/`top`) so spacing stays stable.
- Keep the existing `moduleStatuses` logic intact; only map its values to indicator `status`.

**Test scenarios:**
- Integration: a seeded course with at least one completed module should show a “completed” indicator for that module and an “active” indicator for the first incomplete module.
- Integration: a fresh course (no progress) should show the first module as “active” and the rest as “upcoming”.

**Verification:**
- The course overview page renders the new indicators with correct alignment on the vertical rail and no layout shifts in the “Course Journey” list.

---

- U3. **Theme verification pass (Apple scheme parity)**

**Goal:** Ensure the indicator looks correct across themes, especially `.apple` (Action Blue + muted neutrals) which the provided HTML implies.

**Requirements:** R2

**Dependencies:** U1, U2

**Files:**
- Modify (if needed): `src/app/components/course/CourseJourneyNodeIndicator.tsx`

**Approach:**
- Verify the indicator uses token-derived colors (brand/success/muted/border) rather than hardcoded hexes.
- Ensure focus-visible behavior remains handled globally (no custom focus rings on decorative nodes).

**Test expectation:** none — visual parity check only.

**Verification:**
- In light/dark and `.apple` scheme, the indicator maintains contrast and the “active” ring reads as brand-blue while “completed” reads as success-green and “upcoming” reads as muted.

---

## System-Wide Impact

- **Interaction graph:** Only affects rendering in `CourseOverview` (“Course Journey” timeline).
- **Unchanged invariants:** Route structure, progress computation, module expand/collapse, and lesson navigation remain unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Reference HTML used a lock for “later” modules | Use a neutral circle for upcoming so the UI does not imply gating until real locks exist |
| Theme token mismatch in `.apple` scheme | Use existing tokens (`brand`, `success`, `muted-foreground`, `border`, `card/background`) and avoid hex colors |

---

## Sources & References

- Relevant implementation: `src/app/pages/CourseOverview.tsx`
- Theme tokens: `src/styles/theme.css`
- HTML reference: provided in the user prompt (Learning Path Detail timeline indicators)


# Web Design Guidelines Review: E10-S02 Empty State Guidance

**Date:** 2026-03-15
**Reviewer:** Claude (automated)
**Story:** E10-S02 — Empty State Guidance
**Verdict:** PASS (with advisory items)

## Summary

The `EmptyState` reusable component and its four integration points (Overview, Notes, Challenges, Reports) are well-constructed. Design tokens are used correctly throughout, the CTA buttons meet touch-target requirements, and the component provides meaningful user guidance. Two medium-severity findings related to reduced-motion compliance and heading hierarchy warrant attention but do not block shipping.

---

## Findings by Severity

### BLOCKER

None.

### HIGH

None.

### MEDIUM

#### M1: Animation does not respect `prefers-reduced-motion` on 3 of 4 pages

**File:** `src/app/components/EmptyState.tsx` (line 39), `src/app/pages/Notes.tsx`, `src/app/pages/Challenges.tsx`, `src/app/pages/Reports.tsx`

The `EmptyState` component uses `motion.div` with a `fadeUp` animation (opacity + translateY, 500ms). The `motion/react` library does **not** automatically respect `prefers-reduced-motion` — it requires an explicit `<MotionConfig reducedMotion="user">` wrapper.

- **Overview.tsx** — Correctly wrapped in `<MotionConfig reducedMotion="user">` at line 197. No issue.
- **Notes.tsx** — No `MotionConfig` wrapper. Animation plays even with reduced-motion enabled.
- **Challenges.tsx** — No `MotionConfig` wrapper. Same issue.
- **Reports.tsx** — No `MotionConfig` wrapper. Same issue.

**WCAG Reference:** 2.3.3 (Animation from Interactions), WCAG 2.1 guideline on motion.

**Fix:** Either:
1. Wrap each page's return in `<MotionConfig reducedMotion="user">`, or
2. Add reduced-motion handling directly in the `EmptyState` component using `useReducedMotion()` from `motion/react` and conditionally skip the animation.

Option 2 is preferable because it makes the component self-contained and safe regardless of parent context.

---

#### M2: Heading level skip — `<h3>` used without preceding `<h2>` in some contexts

**File:** `src/app/components/EmptyState.tsx` (line 45)

The EmptyState always renders `<h3>`. In pages where the EmptyState appears directly after an `<h1>` with no intermediate `<h2>` (notably **Reports** and **Challenges** when the empty state is the only content), this creates a heading level skip (`<h1>` -> `<h3>`).

**WCAG Reference:** 1.3.1 (Info and Relationships) — heading levels should not skip.

**Fix:** Either:
1. Accept a `headingLevel` prop (e.g., `as?: 'h2' | 'h3'`) so each consumer can set the appropriate level, or
2. Change the default to `<h2>` since empty states typically replace the main content area and sit directly below the page `<h1>`.

---

### LOW

#### L1: Decorative icon lacks explicit `aria-hidden`

**File:** `src/app/components/EmptyState.tsx` (line 43)

The icon inside the circular container is purely decorative (the `title` text conveys the meaning). Lucide icons render as inline SVGs which may be announced by some screen readers. Adding `aria-hidden="true"` to the icon or its wrapper would be more explicit.

**Current:**
```tsx
<Icon className="w-8 h-8 text-brand" data-testid="empty-state-icon" />
```

**Suggested:**
```tsx
<Icon className="w-8 h-8 text-brand" aria-hidden="true" data-testid="empty-state-icon" />
```

Note: Lucide icons do set `aria-hidden="true"` by default in recent versions, so this may already be handled at the SVG level. Explicitly setting it is still good practice for clarity.

---

#### L2: No `role` or landmark on the empty state container

**File:** `src/app/components/EmptyState.tsx` (line 39)

The empty state has no ARIA role. Adding `role="status"` would convey to assistive technology that this is an informational region. This is minor because the heading and descriptive text already communicate the purpose.

---

## Positive Observations

1. **Design tokens used correctly** — `bg-brand-soft`, `text-brand`, `text-muted-foreground`, `border-border` (via Card). No hardcoded colors detected.

2. **Touch targets adequate** — Button `size="lg"` resolves to `min-h-11` (44px) which meets the 44x44px WCAG touch target requirement.

3. **CTA semantics correct** — Link-based actions use `<Button asChild><Link>` (renders as `<a>`), callback-based actions use `<Button onClick>` (renders as `<button>`). Both are semantically appropriate.

4. **Meaningful empty state copy** — Each instance provides context-specific guidance:
   - Overview: "Import your first course to get started"
   - Notes: "Start a video and take your first note"
   - Challenges: "Create your first learning challenge"
   - Reports: "Start studying to see your analytics"

5. **Consistent spacing** — `py-12 px-6` padding, `mb-4/mb-2/mb-6` vertical rhythm, `max-w-sm` on description text for readability.

6. **Dashed border pattern** — `border-2 border-dashed` is a well-established empty state visual convention that clearly signals "nothing here yet."

7. **Animation is tasteful** — 500ms duration with a custom ease curve (`[0.16, 1, 0.3, 1]`) provides a subtle entrance without being distracting. The 16px translateY is restrained.

8. **Test IDs present** — All four instances have unique `data-testid` attributes for E2E test targeting.

---

## Verdict: PASS

No blockers or high-severity issues. Two medium items (M1: reduced-motion on 3 pages, M2: heading level skip) are recommended fixes but do not block the story. The component is well-designed, accessible in most respects, and follows project conventions.

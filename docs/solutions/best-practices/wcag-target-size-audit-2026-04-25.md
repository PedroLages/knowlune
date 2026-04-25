---
title: "Automating WCAG 2.5.8 target-size audits in Playwright"
date: 2026-04-25
problem_type: best_practice
track: knowledge
category: best-practices
module: accessibility
component: tests/audit
tags: [wcag, accessibility, playwright, audit, target-size, dev-tooling]
---

# Automating WCAG 2.5.8 Target-Size Audits in Playwright

## Context

Knowlune needed an automated regression guard for WCAG 2.5.8 (Target Size,
Minimum) AA. The naive approach — "find every interactive element, fail if
< 24x24 px" — produced ~20 false-positive failures from three sources that
the spec-text exception language addresses but a literal implementation
misses.

## Guidance

When building a Playwright target-size audit, bake in four exclusion
predicates from day one:

1. **Hidden elements** — `display: none`, `visibility: hidden | collapse`,
   `aria-hidden="true"`, or zero-rect.
2. **`sr-only` / `visually-hidden` skip-links** — clip to 1x1 by design;
   they only appear on focus and WCAG 2.5.8 does not apply to elements
   that are visually hidden.
3. **Inline links inside prose** — the WCAG inline-text exception is
   broader than `<p>` ancestors. Login footer copy ("By continuing you
   agree to our **Privacy Policy** and **Terms of Service**") puts
   `<a>` inside a `<div>` of muted text. Detect via "parent has > N chars
   of surrounding text AND parent is rendered inline/block (not flex/grid
   row)."
4. **Third-party dev-only widgets** — `agentation`, the visual feedback
   toolbar Knowlune renders via portal in dev mode only, injects ~10
   small interactive controls into every page. Exclude via root markers
   (`data-feedback-toolbar`, `data-annotation-popup`, `data-annotation-marker`)
   plus a CSS-Modules class fallback (`styles-module__`).

Spacing-exception math: nearest-neighbor distance is the **L-infinity gap**
(min of axis-aligned x and y distances). Two rects that overlap on either
axis have zero clearance on that axis, which correctly handles chip rows.

## Why This Matters

Without the predicates, the audit fails 20/20 cases on `main` against an
already-compliant codebase. Engineers learn to ignore audit failures
("it's just the dev toolbar"), which kills the regression guard's value.
With the predicates, the audit's signal is high — every reported violation
is a real Knowlune-owned issue.

## When to Apply

- Any project adding WCAG 2.5.8 conformance testing to an existing app.
- When the dev environment includes portal-rendered debug overlays
  (Storybook, React DevTools highlights, agentation, custom dev shells).
- When the app has skip-links or footer prose with inline links.

## Examples

**Wrong** — literal implementation:

```ts
const violations = rects.filter(r => r.width < 24 || r.height < 24)
```

Produces 20 false positives.

**Right** — predicate-driven exclusion:

```ts
// At collection time, classify each rect
const excluded =
  isHidden(el) ||
  isScreenReaderOnly(el) ||
  isInlineLinkInProse(el) ||
  isNativeSelectChrome(el) ||
  isThirdPartyDevWidget(el)

// At analysis time, drop excluded rects from both subjects AND neighbors
const live = rects.filter(r => !r.excluded)
const violations = live
  .filter(r => r.width < 24 || r.height < 24)
  .filter(r => nearestNeighborDistance(r, live) < 24)
```

**Inline-prose detection** (broader than `<p>` only):

```ts
function isInlineLink(el: HTMLElement): boolean {
  if (el.tagName.toLowerCase() !== 'a') return false
  const parent = el.parentElement
  if (!parent) return false
  if (parent.tagName.toLowerCase() === 'p') return true
  const parentText = (parent.textContent || '').trim()
  const ownText = (el.textContent || '').trim()
  const hasSurroundingText = parentText.length > ownText.length + 3
  if (!hasSurroundingText) return false
  const display = window.getComputedStyle(parent).display
  return display === 'block' || display === 'inline' || display === 'inline-block'
}
```

## References

- Story: `docs/implementation-artifacts/stories/E66-S02-target-size-audit.md`
- Plan: `docs/plans/2026-04-25-003-feat-e66-s02-target-size-audit-plan.md`
- Implementation: `tests/audit/target-size-helpers.ts`,
  `tests/audit/target-size.spec.ts`
- WCAG 2.1 SC 2.5.8 Target Size (Minimum), AA

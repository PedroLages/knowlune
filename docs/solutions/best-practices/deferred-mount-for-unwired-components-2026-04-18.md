---
title: "Deferred mount for feature-complete-but-unwired components"
date: 2026-04-18
category: docs/solutions/best-practices/
module: library
problem_type: best_practice
component: architecture
severity: medium
applies_when:
  - A UI component is fully built, tested, and review-clean
  - Its real data source will arrive in a future story
  - Shipping the component mounted with mock data would expose placeholder content to end users
tags: [react, routing, feature-flags, mock-data, production-safety, review-findings]
---

# Deferred mount for feature-complete-but-unwired components

## Context

E116-S03 built `LibraryShelves`, a container component that renders a full Library page's worth of shelves. The component was complete: typed, tested, design-review-clean. But the real data pipeline (user library content, sorted/grouped appropriately) was planned for a later epic.

The initial S03 implementation unconditionally mounted `<LibraryShelves />` on the Library route with mock data as a placeholder. R1 code review flagged this as **MEDIUM** severity: mock data was about to ship to production.

## Options considered

1. **Delete the component** — loses the reviewed, tested work.
2. **Ship with mock data and a "coming soon" banner** — still exposes placeholder content.
3. **Ship the component but gate the mount** — preserves the work, blocks placeholder content from production. ✅

## Pattern

```tsx
// Library.tsx
export function Library() {
  // ...
  return (
    <>
      {/* existing Library content */}
      {shelvesReady && <LibraryShelves data={realData} />}
    </>
  )
}
```

Or even simpler: do not import/render `LibraryShelves` on the route yet. The component's tests still cover its behavior; the future data-wiring story flips the switch.

## Why this is better than alternatives

- **Preserves review work** — the component already passed design, code, and test review. Deleting it wastes that investment.
- **No placeholder in production** — users never see mock/fake content.
- **Trivially reversible** — the data-wiring story is a one-line change to mount the component.
- **Discoverable** — a grep for the unmounted component surfaces the pending wiring work.

## Signals that you need this pattern

- A reviewer asks "where is the real data coming from?"
- A story's AC is satisfied by the component's existence but no AC mentions real data.
- The story immediately before the data-wiring story is tempted to ship mock data "temporarily."

## Case study: E116-S03

- **R1 finding (MEDIUM):** `LibraryShelves` mounted unconditionally with mock data on `/library` route.
- **Fix:** Removed the unconditional mount from `Library.tsx`. Component file, tests, and barrel export all remain.
- **Deferred issue:** S03 LOW-severity known-issue: real data wiring for `LibraryShelves` — tracked in `docs/known-issues.yaml` for a future epic.

## Related

- `docs/engineering-patterns.md` → "Deferred Mount for Feature-Complete-but-Unwired Components"
- `docs/known-issues.yaml` (track the deferred wiring)

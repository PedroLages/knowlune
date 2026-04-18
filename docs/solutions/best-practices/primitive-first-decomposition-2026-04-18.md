---
title: "Primitive-first decomposition for page features"
date: 2026-04-18
category: docs/solutions/best-practices/
module: library
problem_type: best_practice
component: architecture
severity: medium
applies_when:
  - A new page feature contains 2+ sections sharing a common visual primitive
  - The feature can be split into "atomic primitives" + "integration/container" stories
  - You're tempted to build the whole feature in a single story
tags: [react, components, story-decomposition, ce-orchestrator, primitives, blast-radius]
---

# Primitive-first decomposition for page features

## Context

E116 "Library Page Primitives" delivered a multi-shelf Library page. The naive decomposition would have been a single story: "Build Library page with shelves." Instead the epic was split into three stories:

- **S01** — `LibraryShelfRow` primitive (PR #338)
- **S02** — `LibraryShelfHeading` + `ShelfSeeAllLink` + barrel (PR #339)
- **S03** — `LibraryShelves` container + Library page integration (PR #340)

All three PRs shipped in a single CE orchestrator epic-loop run on 2026-04-18.

## Pattern

Split a page feature along the **blast radius** seam, not along the file-count seam:

1. **Primitive stories first** — each new atomic component lives in its own story, with its own PR, tests, and review.
2. **Integration story last** — the story that imports the primitives and mounts them on the route.
3. **Barrel export** — the last primitive story establishes `src/app/components/<module>/index.ts` so the integration story has a stable import surface.

## Why it works

- Review feedback on a primitive changes one file. Review feedback on an integrated feature cascades through every consumer.
- By the time the integration story lands, the primitives are already hardened — the integration review can focus on integration-level concerns (data wiring, layout composition, mount gating) rather than primitive-level polish.
- If the integration story needs to be descoped or deferred (e.g., real data isn't ready), the primitives still ship as reusable infrastructure.

## Evidence from E116

- **S03 R1 review** caught exactly one MEDIUM issue: mock data shipping to production via the `<LibraryShelves />` mount. This was a pure integration concern — the primitives themselves were clean. Fix was to gate the mount behind a real-data readiness check.
- **Zero review findings** on primitive behavior across S01 and S02 — the isolation of single-primitive PRs made them easy to reason about.
- Epic shipped all three PRs the same day via CE orchestrator, with no review-loop thrashing.

## When to use

- Page features with 2+ structurally similar sections.
- Features where the primitive is likely reusable elsewhere (even if no second consumer is known today — see also [extract-shared-primitive-on-second-consumer](./extract-shared-primitive-on-second-consumer-2026-04-18.md)).
- Epics running through CE orchestrator's epic-loop where parallel/sequential PR review is already cheap.

## When NOT to use

- One-off page work where the primitive has exactly one consumer forever (just inline it).
- Features under tight deadline pressure where three review rounds cost more than one integration review would.

## Related

- [extract-shared-primitive-on-second-consumer-2026-04-18.md](./extract-shared-primitive-on-second-consumer-2026-04-18.md)
- `docs/engineering-patterns.md` → "Primitive-First Decomposition for Page Features"
- `docs/engineering-patterns.md` → "Barrel Export as Module Public API"

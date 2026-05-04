---
title: fix: Authors grid specialty overflow and course count parity
type: fix
status: active
date: 2026-05-04
origin: _(none — synthesized from screenshot + code review; no matching `docs/brainstorms/*-requirements.md` for this page)_ 
---

# fix: Authors grid specialty overflow and course count parity

## Overview

The multi-author grid on `Authors` shows author cards (`AuthorCard`). Two issues surfaced in production-like data (screenshot evidence): (1) a long, single-row “skills” strip that overflows the card and visually intrudes toward the neighboring column; (2) course totals that read **0** on the grid even when the profile/featured layouts correctly attribute imported courses.

## Problem Frame

1. **Layout / readability (primary)** — Specialty tags render as `Badge` components (`src/app/components/ui/badge.tsx`) whose base styles include **`whitespace-nowrap`**. When `ImportedAuthor.specialties` contains **one element** holding a comma- (or similarly) separated list — e.g. `["DevOps, Cloud Engineering, Docker, Kubernetes, CI/CD …"]` — the UI renders **one badge** spanning the entire string without wrapping inside the card. That matches the dark horizontal strip between the subtitle and the stats row described in QA (mistaken for a misplaced tooltip).

2. **Semantic inconsistency (secondary)** — `AuthorCard` displays `author.courseCount` from `AuthorView` (`src/lib/authors.ts` → `importedToView` → `getImportedAuthorStats`). `getImportedAuthorStats` counts only **`useCourseStore` canonical courses**. `FeaturedAuthorProfile` inside the same page and **`AuthorProfile`** both include **`useCourseImportStore.importedCourses`** when computing totals. The grid therefore under-reports courses whenever an author is only (or mostly) linked via imported courses.

## Requirements Trace

- **R1.** Multi-author **author cards** must not allow specialty UI to extend beyond the card’s visual bounds or overlap adjacent columns (wrap, truncate, and/or normalize data so multiple concise badges appear).
- **R2.** **Course count** on each author card must match the same definition of “courses for this author” already used on **`AuthorProfile`** and **`FeaturedAuthorProfile`**: canonical `Course` rows **plus** `ImportedCourse` rows with matching `authorId`.
- **R3.** Long **title** lines on cards should not sprawl without limit (defensive clamp consistent with bio handling).
- **R4.** Changes must stay compatible with **`getMergedAuthors`** as the corpus projection for search/palette (`src/lib/useUnifiedSearchIndex.ts`, `SearchCommandPalette`, `main.tsx` bootstrap) — avoid breaking call sites that only pass `storeAuthors`.

## Scope Boundaries

- **In scope:** `AuthorCard` layout; specialty normalization at the `AuthorView` boundary; reactive, accurate `courseCount` on the authors grid; unit tests in `src/lib/__tests__/authors.test.ts` and focused updates in `src/app/pages/__tests__/Authors.test.tsx`.
- **Non-goals:** Redesigning the authors page, changing import pipelines that populate `specialties`, migrating historical Dexie rows (display-layer normalization is sufficient unless product asks for a backfill), fixing unrelated **`AuthorProfile`** stats that only sum canonical course hours/lessons for the “Content/Lessons” strip (separate product decision).
- **Deferred to separate tasks:** Optional **write-time** normalization in `AuthorFormDialog` when saving specialties (reduces bad shapes at source); optional search-index field splitting if product wants tokenized specialty search on CSV-shaped data.

## Context & Research

### Relevant Code and Patterns

- **`AuthorCard`** — `src/app/pages/Authors.tsx` (specialty badges; title line without clamp; `author.courseCount` from `AuthorView`).
- **`Badge`** — `src/app/components/ui/badge.tsx` — `whitespace-nowrap` + `shrink-0` makes monolithic specialty strings overflow grid cells.
- **`importedToView` / `getImportedAuthorStats`** — `src/lib/authors.ts` — course count source for cards today; import store omitted.
- **Parity reference** — `FeaturedAuthorProfile` in `Authors.tsx` and `AuthorProfile.tsx` filter both `courses` and `importedCourses` by `author.id`.
- **`VirtualizedGrid`** — with only two authors, `items.length <= columns * 6` uses the **non-virtualized** branch; root cause is not virtualization positioning.

### Institutional Learnings

- `docs/solutions/developer-experience/authors-sync-silent-reload-modal-layout-vitest-sonner-2026-05-04.md` — authors UX has been sensitive to reload and dialog layout; prefer **narrow layout changes** in `AuthorCard` and **`min-w-0` / truncation** conventions that match other cards.

### External References

- None required — local Tailwind + shadcn patterns suffice.

## Key Technical Decisions

- **Decision — Normalize specialties when building `AuthorView`:** Split comma-/semicolon-/pipe-separated tokens inside each `specialties[]` entry, trim, drop empties, dedupe conservatively (case-insensitive or preserve first casing — choose one stable rule and document in code comment). Keeps **`SearchCommandPalette`** / unified index beneficiaries aligned without changing function signatures everywhere.

- **Decision — Pure course counting helper:** Add `totalCoursesForAuthor(authorId, courses, importedCourses)` in `src/lib/authors.ts` (or adjacent module) with **no** Zustand `getState` inside, so `Authors.tsx` can `useMemo` over **hook-subscribed** `courses` and `importedCourses`. Ensures counts **update** when `loadImportedCourses` resolves (fixing silent stale “0” after async hydration).

- **Decision — Card-level CSS containment:** Apply **`min-w-0`** on flex children and **`max-w-full truncate`** (or `line-clamp` on a non-badge fallback) on specialty badges **in `AuthorCard` only** before considering a global `Badge` change — avoids unintended truncation across the app.

## Open Questions

### Resolved During Planning

- **Is the “tooltip” a Radix `Tooltip` bug?** — No; `AuthorCard` does not use `Tooltip` for specialties. The strip is consistent with **one wide `Badge`**.

- **Should we change `getMergedAuthors` signature?** — No; keep signature stable. Derive corrected `courseCount` in `Authors.tsx` via a second `useMemo` mapping over `getMergedAuthors(storeAuthors)` with the pure counter, or fold count into a small `withAuthorCourseCounts(views, courses, importedCourses)` helper beside `getMergedAuthors`.

### Deferred to Implementation

- **Exact dedupe rule for split specialties** (case-folding vs. strict string equality) — pick the rule that matches `AuthorFormDialog` tag behavior most closely.

## Implementation Units

- [ ] **Unit 1: Normalize specialties in `AuthorView` construction**

**Goal:** Ensure `AuthorView.specialties` is always an array of short tokens, never a single CSV blob.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `src/lib/authors.ts`
- Test: `src/lib/__tests__/authors.test.ts`

**Approach:**
- Add a focused pure helper (e.g. `flattenSpecialties(input: string[]): string[]`) used from `importedToView`.
- Cover inputs: empty array; well-formed multi-entry; single entry with commas/semicolons/pipes; extra whitespace; duplicate tokens after split.

**Patterns to follow:** Existing pure helpers at bottom of `authors.ts`; keep `getMergedAuthors` export unchanged.

**Test scenarios:**
- **Happy path:** `["React", "Node"]` unchanged (order preserved).
- **Happy path:** `["A, B, C"]` → three entries.
- **Edge case:** `["  ", "", "Rust"]` → `["Rust"]`.
- **Edge case:** malformed but single token → unchanged.

**Verification:** Unit tests green; specialty badges on cards break into multiple smaller badges for CSV-shaped data.

---

- [ ] **Unit 2: Constrain overflow in `AuthorCard` (titles + badges)**

**Goal:** Guarantee card-internal layout resilience even if malformed data slips through.

**Requirements:** R1, R3

**Dependencies:** Unit 1 (behavioral nicest together; may land in either order if CSS is defensive)

**Files:**
- Modify: `src/app/pages/Authors.tsx`
- Test: `src/app/pages/__tests__/Authors.test.tsx`

**Approach:**
- Title `<p>`: add **`line-clamp-2`** (and optional `break-words`) mirroring bio handling.
- Specialty row container: **`min-w-0 w-full`**, **`justify-center`** retained; each `Badge`: **`max-w-full truncate`** override (works with nowrap).
- Optionally ensure the outer **`Card`** column flex chain includes **`min-w-0`** on the link/card wrapper per grid-item best practice.

**Test scenarios:**
- **Happy path:** With Unit 1 data, headings and badges visible, no horizontal scroll inside card snapshot (query DOM widths if needed vs. grid cell).
- **Edge case:** Force an author with **intentionally** long single-token specialty after normalization → badge truncates with ellipsis rather than widening the grid.

**Verification:** Manual check on `/authors` with 2-column layout at `sm` breakpoint matches screenshot scenario without cross-column bleed.

---

- [ ] **Unit 3: Course count parity on the authors grid**

**Goal:** `AuthorCard` shows canonical + imported course totals, updating when stores hydrate.

**Requirements:** R2, R4

**Dependencies:** None (ordering: after Unit 2 for fewer visual test flapping)

**Files:**
- Modify: `src/lib/authors.ts` (pure `totalCoursesForAuthor` helper + types import from `@/data/types` as needed)
- Modify: `src/app/pages/Authors.tsx` — subscribe **`useCourseStore(s => s.courses)`**, **`useCourseImportStore`**, **`useLazyStore(loadImportedCourses)`** alongside existing author lazy load
- Test: `src/app/pages/__tests__/Authors.test.tsx` (mock import store similarly to FeaturedAuthor paths if not already present)

**Approach:**
- Replace `useMemo(() => getMergedAuthors(storeAuthors), …)`-only pipeline with **`allAuthors`** that maps merged views while overriding **`courseCount`** via the pure helper.
- Mirror **`FeaturedAuthorProfile`** filters: `courses.filter(c => c.authorId === id)` plus `importedCourses.filter(...)`.

**Test scenarios:**
- **Happy path:** Author with `authorId` on one imported course, zero canonical courses → card shows **1** (stub `useCourseImportStore` state).
- **Happy path:** Author with canonical courses only → count matches filtered `courses` length (existing mock `useCourseStore` behavior).
- **Edge case:** `authorId` **undefined / missing** on imported course rows → does not inflate count (explicitly align with profile filters).

**Verification:** Numbers on grid match **`AuthorProfile`** header stats for the same author IDs in dev.

---

## System-Wide Impact

- **Interaction graph:** Authors list only; **`getMergedAuthors`** consumers keep the same arity; **`courseCount` inside `AuthorView`** remains meaningful everywhere but only **authors grid** relies on richer counting after this fix (search snippets may still show older counts unless index builder is updated — acceptable non-goal unless product requests).
- **Error propagation:** None — pure derivation.
- **State lifecycle risks:** Subscribe to **`importedCourses`** in **`Authors.tsx`** so counts refresh after **`loadImportedCourses`**; avoid **`getState()`-only snapshots inside `lib` for this metric.
- **Unchanged invariants:** Dexie schemas, routing, **`AuthorProfile`** course list merging logic stays as-is aside from benefiting from normalized specialties via **`importedToView`**.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Specialty splitting over-splits legitimate labels containing commas | Prefer splitting **only when a single array entry** contains separators **and** splits produce multiple tokens; alternatively limit to commas if product confirms |
| Duplicate `authors.ts` coupling to course types | Keep counting pure and typed against existing `Course` / `ImportedCourse` |
| Tests missing import-store mocks | Extend `Authors.test.tsx` mocks following existing `useCourseStore` mock patterns |

## Documentation / Operational Notes

- None required beyond this plan unless a follow-up **`docs/solutions/`** note is desired after verification.

## Sources & References

- **Origin document:** _(none)_
- **Related code:** `src/app/pages/Authors.tsx`, `src/lib/authors.ts`, `src/app/components/ui/badge.tsx`, `src/app/pages/AuthorProfile.tsx`

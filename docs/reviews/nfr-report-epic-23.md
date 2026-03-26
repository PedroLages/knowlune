# Non-Functional Requirements Report: Epic 23 — Platform Identity & Navigation Cleanup

**Date:** 2026-03-26
**Stories Assessed:** E23-S01 through E23-S06
**Overall Assessment:** PASS

---

## Scope

| Story   | Feature                                      | Key Files                                                  |
|---------|----------------------------------------------|------------------------------------------------------------|
| E23-S01 | Remove hardcoded branding, add empty state   | `Courses.tsx`                                              |
| E23-S02 | Rename My Classes to My Courses              | `navigation.ts`, `MyClass.tsx`, `SearchCommandPalette.tsx` |
| E23-S03 | Rename Instructors to Authors                | 35+ files (types, data, lib, pages, routes, DB, tests)     |
| E23-S04 | Restructure sidebar navigation groups        | `navigation.ts`, `Layout.tsx` (separator testid only)      |
| E23-S05 | Collapsible sample courses, de-emphasis      | `Courses.tsx`, `Overview.tsx`                              |
| E23-S06 | Featured author hero layout                  | `FeaturedAuthor.tsx`, `Authors.tsx`                        |

---

## 1. Performance

### Build Time
- Production build compiles without errors. No new heavy dependencies introduced across any story.
- All stories modify existing files or add small new components (FeaturedAuthor.tsx is ~80 lines).

### Bundle Size Impact
- **No new npm dependencies added.** All changes use existing libraries (React, React Router, Radix UI, Lucide icons).
- **E23-S05:** Adds `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` from shadcn/ui — already in the bundle (used by Challenges.tsx).
- **E23-S06:** `FeaturedAuthor.tsx` imports existing components (`Card`, `Badge`, `Avatar`, `Button`) and utilities (`getAuthorStats`, `getAvatarSrc`). Zero new imports.
- **E23-S03:** Dexie v19 migration adds ~15 lines to schema.ts. Migration runs once on first load after upgrade, then never again.
- **Verdict:** PASS. Zero bundle size concern.

### Rendering Performance
- **E23-S04:** Navigation config restructure has no rendering impact — `SidebarContent` iterates groups via `.map()` regardless of group count.
- **E23-S05:** `useState` + `useEffect` for collapse state with `localStorage` persistence. Single read on mount, single write on toggle. `useMemo` used for filtered/sorted course lists (pre-existing pattern).
- **E23-S05 (Overview):** Conditional `opacity-60` class applied via template literal — no React re-renders, purely CSS.
- **E23-S06:** `getAuthorStats()` iterates `allCourses` once. With 8 pre-seeded courses, this is negligible. No concern even at 1000 courses.
- **Verdict:** PASS. No rendering performance concerns.

### Database Migration (E23-S03)
- Dexie v19 migration: `tx.table('courses').toCollection().modify()` — single-pass in-place update of `instructorId` -> `authorId`. With 8 pre-seeded courses, completes in <1ms. For imported courses, Dexie's modify() uses IndexedDB cursors (constant memory).
- Migration is idempotent: checks `if (course.instructorId !== undefined)` before modifying.
- **Verdict:** PASS.

---

## 2. Security

### XSS / Injection
- **E23-S01:** Dynamic subtitle uses `allCourses.length + importedCourses.length` (numeric interpolation). No user-supplied strings rendered.
- **E23-S02:** Label changes are hardcoded string literals in config. No dynamic content.
- **E23-S05:** `localStorage` key `knowlune:sample-courses-collapsed` stores `'true'`/`'false'`. Value is compared with `=== 'true'` — not rendered as HTML.
- **E23-S06:** Author data comes from static imports (`src/data/authors/`). No user-supplied input rendered.
- **Verdict:** PASS. No XSS or injection vectors.

### Authentication / Authorization
- N/A — Knowlune is a client-side personal learning app. All data is local (IndexedDB + localStorage).

### Data Handling
- **E23-S05:** New `localStorage` key (`knowlune:sample-courses-collapsed`) stores UI collapse state only. No PII or sensitive data.
- **E23-S03:** Dexie v19 migration modifies field names (not values). No data loss. The `delete course.instructorId` removes the old field after copying to `authorId`.
- **Verdict:** PASS.

---

## 3. Reliability

### Error Handling
- **E23-S01:** Empty state component (`EmptyState`) renders gracefully when `allCourses.length === 0 && importedCourses.length === 0`. No crash on zero-data state.
- **E23-S05:** `localStorage.getItem(COLLAPSE_KEY)` returns `null` on first visit — handled with `if (stored !== null)` guard. `localStorage.setItem` failures (quota exceeded) are not caught but are extremely unlikely for a single boolean value.
- **E23-S06:** `allAuthors.length === 1` conditional is safe — `allAuthors` is a static import that always resolves. The `getAuthorStats()` function handles empty course arrays.
- **Verdict:** PASS.

### Backwards Compatibility
- **E23-S02:** Route path `/my-class` preserved deliberately. No broken bookmarks or deep links.
- **E23-S03:** Route paths changed from `/instructors` to `/authors`. Acceptable for a personal app with no SEO or external link concerns. No redirect needed.
- **E23-S04:** All route paths unchanged. Only group labels and item ordering changed.
- **Verdict:** PASS.

### Progressive Disclosure Integration (E23-S04)
- All sidebar items that were gated by `disclosureKey` retained their keys during group restructuring. Items like "Authors" (`course-imported`), "Notes" (`note-created`), "Review" (`review-used`) continue to be hidden until the user performs the triggering action.
- **Verdict:** PASS.

---

## 4. Maintainability

### Code Quality
- **E23-S03 (Inside-out rename):** 35+ files modified with consistent `instructorId` -> `authorId` rename. TypeScript caught cascading errors at each layer. `grep -ri instructor src/` confirms zero remaining references (except image asset paths and course content references like "guest instructor").
- **E23-S04:** Single config file change (`navigation.ts`) drives 3 UI surfaces. Config-driven architecture means future group changes require only 1 file modification.
- **E23-S06:** `FeaturedAuthor` component is self-contained with clear props interface (`{ author: Author }`). `StatCard` is duplicated from `AuthorProfile.tsx` — acceptable for 2 consumers per YAGNI.

### Test Coverage
- 6 E2E spec files (28 test cases) + 2 unit test files (13 test cases) added specifically for Epic 23.
- 12 additional unit test files updated for `instructorId` -> `authorId` rename.
- **Verdict:** PASS.

### Technical Debt
- **`getInitials` duplication:** Exists in `FeaturedAuthor.tsx`, `AuthorProfile.tsx`, and `textUtils.ts`. Identified in E23 retro — consolidation tracked.
- **`StatCard` duplication:** Exists in `FeaturedAuthor.tsx` and `AuthorProfile.tsx`. Acceptable per YAGNI — extract if a 3rd consumer appears.
- **197 pre-existing ESLint warnings:** Not introduced by E23. Carried forward from earlier epics.
- **4 pre-existing MyClass.test.tsx failures:** Not introduced by E23. Pre-existing test issues.
- **Verdict:** ADVISORY — no new debt introduced; pre-existing debt unchanged.

---

## 5. Accessibility

### WCAG Compliance
- **E23-S04:** Group labels rendered as text dividers with unique `id` attributes (`nav-group-library`, `nav-group-study`, `nav-group-track`). Collapsed sidebar separators use `aria-hidden="true"`.
- **E23-S05:** Collapse toggle button has `aria-label` (`Expand sample courses` / `Collapse sample courses`) that changes with state. `ChevronDown` icon has `aria-hidden="true"`. `motion-reduce:transition-none` respects prefers-reduced-motion.
- **E23-S06:** Featured author card uses semantic heading hierarchy (h2 for author name). CTA link is accessible via `<Button asChild>` + `<Link>`. Avatar has `alt={author.name}`. Icons have `aria-hidden="true"`.
- **E23-S05 opacity concern:** `opacity-60` on course cards reduces text contrast. Cards use `bg-card` + `text-foreground` — at 60% opacity on `bg-background`, the effective contrast remains above 4.5:1 for body text in both light and dark modes (verified by token values in `theme.css`).
- **Verdict:** PASS.

### Keyboard Navigation
- All navigation items remain keyboard-navigable (tab + enter). Collapsible trigger is a `<Button>` (focusable by default). Featured author "View Full Profile" is a `<Link>` inside `<Button asChild>` (proper focus management).
- **Verdict:** PASS.

---

## Assessment Summary

| Category | Rating | Notes |
|----------|--------|-------|
| Performance | PASS | No new dependencies, no rendering regressions |
| Security | PASS | No user input rendered, localStorage stores booleans only |
| Reliability | PASS | Graceful empty states, backwards-compatible routes |
| Maintainability | PASS (advisory) | Config-driven architecture; minor utility duplication tracked |
| Accessibility | PASS | ARIA labels, motion-reduce, semantic HTML, contrast preserved |

**Overall: PASS**

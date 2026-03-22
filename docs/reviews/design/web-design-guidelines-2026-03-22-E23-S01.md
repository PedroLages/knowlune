# Web Design Guidelines Review — E23-S01 (2026-03-22)

Review of `src/app/pages/Courses.tsx` against [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).

## src/app/pages/Courses.tsx

### HIGH

src/app/pages/Courses.tsx:219 — `transition-all` on Button className → list properties explicitly (e.g. `transition-[transform,box-shadow]`). Anti-pattern per guidelines.

### MEDIUM

src/app/pages/Courses.tsx:252 — placeholder `"Search for courses..."` → `"Search for courses…"` (use ellipsis `…` not `...`)
src/app/pages/Courses.tsx:224 — `"Scanning..."` → `"Scanning…"` (loading states end with `…`)
src/app/pages/Courses.tsx:308 — `"Scanning..."` → `"Scanning…"` (duplicate occurrence)
src/app/pages/Courses.tsx:252 — search input missing `name` attribute and `autocomplete="off"` (avoids password manager triggers on non-auth fields)
src/app/pages/Courses.tsx:38-42 — filters/search state (`searchQuery`, `selectedCategory`, `selectedTopics`, `selectedStatuses`, `sortMode`) not reflected in URL params. Guidelines: "URL reflects state—filters, tabs, pagination, expanded panels in query params"

### LOW

src/app/pages/Courses.tsx:211 — course count display could benefit from `font-variant-numeric: tabular-nums` (`tabular-nums` class) for number columns
src/app/pages/Courses.tsx:248 — flex child `.relative.flex-1` missing `min-w-0` for text truncation safety in flex layout
src/app/pages/Courses.tsx:316-318 — filter empty state text could use `text-pretty` to prevent widows

### PASS

- ✓ Accessibility: all interactive elements use `<button>` or `<a>`, icon buttons have `aria-label`, form controls have labels
- ✓ Semantic HTML: proper heading hierarchy (`h1` → `h2`), `role="region"` on empty state
- ✓ Decorative icons: `aria-hidden="true"` on FolderOpen in empty state
- ✓ Dark mode: uses design tokens (`bg-card`, `text-muted-foreground`, `bg-brand`) — no hardcoded colors
- ✓ Empty states: both global and per-section empty states handled correctly
- ✓ Responsive grid: proper breakpoint grid (`grid-cols-1 sm:2 md:3 lg:4 xl:5`)

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 1     |
| MEDIUM   | 3     |
| LOW      | 3     |

**Verdict**: No blockers. HIGH finding (`transition-all`) is pre-existing pattern used across the app — not introduced by E23-S01. MEDIUM URL state sync is a broader architectural concern beyond this story's scope.

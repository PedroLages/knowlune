# Web Interface Guidelines Review — E23-S06

**Story:** E23-S06 "Featured Author Layout For Single Author State"
**Date:** 2026-03-23
**Reviewer:** Claude (Web Interface Guidelines skill)
**Source:** https://github.com/vercel-labs/web-interface-guidelines

---

## src/app/components/figma/FeaturedAuthor.tsx

FeaturedAuthor.tsx:8 - `transition-all` on button base class (inherited via `<Button>`) — prefer listing properties explicitly. Accepted: comes from shared `button.tsx` variant, not this file's concern.

FeaturedAuthor.tsx:47 - `<h2>` heading: consider `text-wrap: balance` to prevent widows on narrow viewports

FeaturedAuthor.tsx:52 - Curly quotes used correctly via `&ldquo;`/`&rdquo;` ✓

FeaturedAuthor.tsx:22 - Decorative icons use `aria-hidden="true"` ✓

FeaturedAuthor.tsx:23 - `tabular-nums` on stat values ✓

FeaturedAuthor.tsx:38-43 - Avatar has `alt={author.name}` ✓, fallback provides initials ✓

FeaturedAuthor.tsx:86 - Bio paragraph uses `max-w-prose` + `leading-relaxed` — good content handling ✓

FeaturedAuthor.tsx:89-91 - CTA uses `<Button variant="brand" asChild>` wrapping `<Link>` — correct navigation pattern (renders `<a>`) ✓

FeaturedAuthor.tsx:89 - Button/Link has visible hover state via `hover:bg-brand-hover` (from variant) ✓ and focus-visible ring (from base) ✓

FeaturedAuthor.tsx:33 - Card has `data-testid` for test targeting ✓

FeaturedAuthor.tsx:74 - Stats grid uses responsive `grid-cols-2 sm:grid-cols-4` — good mobile layout ✓

FeaturedAuthor.tsx:34 - Responsive padding `p-6 sm:p-8` ✓

### Findings

FeaturedAuthor.tsx:47 - heading missing `text-wrap: balance` (prevents orphan/widow words)

FeaturedAuthor.tsx:86 - long bio text: no `line-clamp-*` or truncation — if `shortBio` can be very long, content could overflow. LOW: acceptable if data is controlled.

FeaturedAuthor.tsx:80 - stat label `"Content"` is ambiguous — consider `"Hours"` for clarity. ADVISORY (copy quality, not a guidelines rule).

## src/app/pages/Authors.tsx

Authors.tsx:29 - `<h1>` heading: consider `text-wrap: balance` to prevent widows

Authors.tsx:12-22 - Empty state handled for `allAuthors.length === 0` ✓

Authors.tsx:31-34 - Singular/plural copy handled correctly ✓

Authors.tsx:48-106 - Grid card: `<Link>` wrapping `<Card>` — correct navigation pattern (renders `<a>`, supports Cmd+click) ✓

Authors.tsx:51 - `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` — visible keyboard focus ✓

Authors.tsx:53 - Card hover: `hover:shadow-xl hover:scale-[1.02] transition-all duration-300` — uses `transition-all` anti-pattern

Authors.tsx:57 - Avatar `alt={author.name}` ✓

Authors.tsx:86,93,99 - Decorative icons `aria-hidden="true"` ✓

Authors.tsx:87,94,100 - `tabular-nums` on stat numbers ✓

Authors.tsx:42 - Grid responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ✓

Authors.tsx:88-90,101 - Hidden labels on small screens (`hidden sm:inline`) — acceptable progressive disclosure but stats lose context on mobile (numbers without labels). LOW.

### Findings

Authors.tsx:53 - `transition-all` → list properties explicitly: `transition-[shadow,transform]` or `transition-shadow transition-transform`

Authors.tsx:29 - heading missing `text-wrap: balance`

Authors.tsx:53 - `hover:scale-[1.02]` animation: missing `prefers-reduced-motion` guard. Users with motion sensitivity will see scale transforms. Add `motion-safe:hover:scale-[1.02]` or `@media (prefers-reduced-motion: reduce)` override.

Authors.tsx:64 - `<h2>` heading missing `text-wrap: balance`

Authors.tsx:88-90 - On mobile, stat numbers render without text labels (e.g., just "3" with a book icon). Screen readers get no label text for the stat group — consider `aria-label` on the stat container or visually hidden labels.

---

## Summary

| Severity | Count | Files |
|----------|-------|-------|
| **MEDIUM** | 2 | `transition-all` anti-pattern (Authors.tsx:53), missing `prefers-reduced-motion` (Authors.tsx:53) |
| **LOW** | 4 | `text-wrap: balance` on headings (both files), mobile stat label accessibility (Authors.tsx:88), bio truncation (FeaturedAuthor.tsx:86) |
| **PASS** | — | Semantic HTML, navigation patterns, focus states, design tokens, empty states, icon accessibility, responsive grid, tabular-nums |

### Recommended Fixes

1. **Authors.tsx:53** — Replace `transition-all` with explicit properties:
   ```
   transition-shadow transition-transform duration-300
   ```

2. **Authors.tsx:53** — Add motion preference guard:
   ```
   motion-safe:hover:scale-[1.02]
   ```

3. **Both files, headings** — Add `text-wrap: balance` to `<h1>` and `<h2>` elements.

4. **Authors.tsx:84** — Add `aria-label` to the stats row `<div>` for screen reader context:
   ```
   aria-label={`${stats.courseCount} courses, ${Math.round(stats.totalHours)} hours, ${stats.totalLessons} lessons`}
   ```

### What Passed Well

- Correct use of `<Link>` for navigation (Cmd+click works)
- `<Button variant="brand" asChild>` pattern for CTA links
- `aria-hidden="true"` on all decorative icons
- `tabular-nums` on numeric displays
- Empty state handling for zero authors
- Singular/plural copy adaptation
- Design tokens used throughout (no hardcoded colors)
- Visible `focus-visible` ring on interactive cards
- Responsive grid and padding breakpoints
- Avatar alt text and fallback initials

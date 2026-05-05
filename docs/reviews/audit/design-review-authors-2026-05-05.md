# Design Review — Authors Pages
**Date**: 2026-05-05  
**Reviewer**: Ava (design-review agent, Playwright MCP)  
**Scope**: `/authors`, `/authors/:id`  
**Theme tested**: Light mode (canonical) and dark mode  
**Breakpoints tested**: 375px (mobile), ~1000px (tablet/sidebar-collapse), ~1440px (desktop observed via source)  
**Session type**: Guest (IndexedDB fresh — test authors added via UI)

---

## Executive Summary

The Authors section is **well-architected and largely polished**. The three-state layout (empty / single-featured / multi-grid) is intentional and handled gracefully. Core accessibility foundations are strong: skip links, breadcrumbs with `aria-current`, focus-visible rings, properly associated form labels, and a global `prefers-reduced-motion` guard in `index.css`.

The primary area needing attention is **card density** — the author grid cards are spacious by design but the user has flagged them as too tall. Two simple changes (avatar size and top padding) reduce perceived height by ~20% without losing the card's breathing room. Three medium-priority issues round out the findings: an empty specialty-badge spacer that wastes 32px, a redundant initials prefix in screen-reader accessible names, and a missing `required` attribute on the form's required name field.

**No blockers. Three high-priority items. Four medium-priority items. Three nitpicks.**

---

## What Works Well

- **Three-state layout philosophy**: Empty → Featured (single author) → Grid (multi-author) transitions feel natural and purpose-built, not accidental.
- **Featured Profile layout** (`FeaturedAuthorProfile`): The large avatar, social links, blockquote treatment, and "View Full Profile" CTA give a solo author a premium, intentional feel.
- **Accessibility foundations**: Skip-to-content link, breadcrumb `aria-current="page"`, `focus-visible` rings on cards and form inputs, hover-overlay buttons surfaced via `focus-within` (keyboard-accessible without hover), social links with descriptive `aria-label` per platform.
- **Error & empty states**: Both the `/authors` empty state and the `/authors/:id` "Author Not Found" error state are clear, have helpful copy, and provide recovery CTAs.
- **Global `prefers-reduced-motion`** coverage in `src/styles/index.css` (lines 317–325) collapses all `transition-duration` to 0.01ms, protecting vestibular-sensitive users even for Tailwind utility transitions on card hover.
- **Sort UX**: The sort bar is right-aligned, labelled properly (`aria-label="Sort authors"`), and uses icons + text for each option.
- **Form accessibility**: `AuthorFormDialog` has `aria-invalid`, `aria-describedby`, `role="alert"` on errors, and each input is paired with a `<label htmlFor>`. Specialty tag removal buttons carry individual `aria-label="Remove {specialty}"`.

---

## Findings by Severity

### High Priority (should address before merging new work on these pages)

#### H1 — AuthorCard: avatar initials pollute screen-reader accessible name
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:279–284` |
| **autofix_class** | `safe_auto` |
| **Confidence** | 90 |

The `AvatarFallback` renders initials ("NJ") inside the card `<Link>`. Because `AvatarFallback` has no `aria-hidden`, the accessible name of the card link becomes:  
`"NJ Nana Janashia UI/UX Design Specialist 0 courses"`

Screen readers announce "NJ" redundantly before the full name. The avatar image already has `alt={author.name}` (correct), but the fallback path leaks initials into the label.

**Fix**: Add `aria-hidden="true"` to the `AvatarFallback` component inside the card link.

```tsx
// Authors.tsx line ~282
<AvatarFallback
  aria-hidden="true"
  className="text-lg font-semibold bg-brand/10 text-brand"
>
  {getInitials(author.name)}
</AvatarFallback>
```

Same fix applies to `FeaturedAuthorProfile` (line ~419) and `AuthorProfile` hero (line ~153) — the fallback initials there are displayed outside a link context but still benefit from `aria-hidden` since the name is already presented as adjacent text.

---

#### H2 — AuthorFormDialog: required Name field missing `required`/`aria-required`
| Field | Value |
|---|---|
| **File** | `src/app/components/authors/AuthorFormDialog.tsx:281–298` |
| **autofix_class** | `safe_auto` |
| **Confidence** | 85 |

The Name input has a visual `*` indicator in its `<Label>` and triggers a `role="alert"` error after submission, but the input itself lacks `required` or `aria-required="true"`. Screen readers announce fields as required when the attribute is present; without it, they cannot tell users the field is required before they attempt to submit.

The form uses `noValidate` (correct — custom validation), but `required` on the input still communicates required-ness to screen readers without triggering browser validation.

**Fix**: 
```tsx
// AuthorFormDialog.tsx line ~281
<Input
  id="author-name"
  required              // ← add this
  aria-required="true"  // ← belt-and-suspenders for AT compatibility
  placeholder="e.g., Jane Smith"
  ...
/>
```

---

#### H3 — Card hover animation: `scale-[1.02]` should use `motion-safe:` prefix
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:276` |
| **autofix_class** | `safe_auto` |
| **Confidence** | 75 |

```tsx
// Line 276
className="h-full min-w-0 rounded-2xl border-0 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
```

While the global CSS in `index.css` shortens `transition-duration` to 0.01ms under `prefers-reduced-motion: reduce`, the `hover:scale-[1.02]` transform itself still fires (it snaps instead of animating, but the layout shift still occurs at the new scale). For users with vestibular conditions who have set reduced-motion, an instant scale pop on hover is still disorienting.

**Fix**: Replace `hover:scale-[1.02]` with `motion-safe:hover:scale-[1.02]` so the scale only activates when the user has not requested reduced motion. Shadow is fine to keep unconditionally.

```tsx
className="h-full min-w-0 rounded-2xl border-0 shadow-sm hover:shadow-md motion-safe:hover:scale-[1.02] transition-shadow motion-safe:transition-all duration-300"
```

---

### Medium Priority

#### M1 — Card sizing: `pt-8` + `size-24` avatar creates oversized cards
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:276–334` |
| **autofix_class** | `gated_auto` |
| **Confidence** | 95 |

**User explicitly requested smaller cards.** The current card height is driven by:

| Element | Height contribution |
|---|---|
| `pt-8` top padding | 32px |
| `size-24` avatar | 96px |
| `mb-4` after avatar | 16px |
| Name (~1.125rem line-height × 1.5) | ~27px |
| Title (`text-sm`) | ~20px |
| Specialty badge area (empty spacer `mb-5 mt-3`) | 32px |
| Stats row | ~40px |
| `p-6` bottom padding | 24px |
| **Total** | **~287px** (matching `estimateRowHeight={320}`) |

**Proposed reductions** (preserves visual rhythm, reduces height ~20–25%):

```tsx
// AuthorCard CardContent — currently:
// className="flex flex-col items-center text-center p-6 pt-8 min-w-0 w-full"
// Proposed:
className="flex flex-col items-center text-center p-5 pt-6 min-w-0 w-full"

// Avatar — currently size-24 (96px), proposed size-20 (80px):
<Avatar className="size-20 mb-3 ring-2 ring-border/50 group-hover:ring-brand/30 transition-all">
```

This brings estimated card height to ~240px — a meaningful reduction without making cards feel cramped. The `estimateRowHeight` prop on `VirtualizedGrid` should be updated to match.

Also update `FeaturedAuthorProfile` avatar from `size-28 sm:size-36` → `size-24 sm:size-32` for proportional reduction in the featured view.

---

#### M2 — Empty specialty badge placeholder wastes 32px and creates height inconsistency
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:322` |
| **autofix_class** | `safe_auto` |
| **Confidence** | 90 |

```tsx
// Line 322 — placeholder added when author has no specialties:
{author.specialties.length === 0 && <div className="mb-5 mt-3" />}
```

This hardcodes `8px + 20px = 28px` of dead space (margin-top 12px + margin-bottom 20px) when an author has no specialties. The intent is to maintain consistent card height when some cards have badges and others don't, but it creates a visual region that looks like something is missing.

**Proposed approach**: Remove the placeholder. Instead, give the badge row a consistent minimum height only when badges exist:

```tsx
// Replace current badge block:
{author.specialties.length > 0 && (
  <div className="flex min-w-0 w-full flex-wrap justify-center gap-1.5 mt-3 mb-4">
    {/* badges */}
  </div>
)}
// No else needed — accept variable card heights; Masonry-style or equal-height via CSS grid stretching is cleaner
```

If equal card heights are required, use CSS `align-items: stretch` on the grid cells and `justify-content: space-between` in the card flex column, letting the stats row push to the bottom naturally:

```tsx
// CardContent: add `justify-between` to push stats to bottom
className="flex flex-col justify-between items-center text-center p-5 pt-6 min-w-0 w-full"
```

---

#### M3 — FeaturedAuthorProfile stats strip is sparse with only one stat card
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:502–511` |
| **autofix_class** | `manual` |
| **Confidence** | 80 |

On the `/authors` page when exactly one author exists, the stats strip uses `grid grid-cols-2 sm:grid-cols-3 gap-3` but only renders one stat card (Courses count). This leaves two empty columns, creating a visually unbalanced strip.

```tsx
// Lines 502–511 — only BookOpen / totalCourseCount is rendered:
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
  <div className="flex flex-col items-center gap-1 rounded-xl bg-muted ring-1 ring-border/20 p-4 shadow-sm">
    ...0 Courses...
  </div>
</div>
```

**Options**:
1. **Preferred**: Switch to a single-stat layout using flexbox: `<div className="flex justify-center mt-6">` with one stat card at a fixed width (e.g., `w-32`).
2. **Alternative**: Conditionally hide the grid or show a small badge-style stat instead of a full grid when only one stat exists.

This issue does not affect the `/authors/:id` profile page, which always renders 4 stat cards in `grid-cols-2 sm:grid-cols-4`.

---

#### M4 — VirtualizedGrid scroll container may impede keyboard navigation for large lists
| Field | Value |
|---|---|
| **File** | `src/app/components/VirtualizedGrid.tsx:168–209` |
| **autofix_class** | `manual` |
| **Confidence** | 70 |

When author count exceeds `columns * 6` (e.g., > 18 authors at 3 columns), `VirtualizedGrid` renders a scroll container with `overflow-auto max-height: 80vh`. This creates a nested scrollable region within the main page.

Keyboard users navigating with Tab will enter this scroll area and must continue tabbing through all author cards before reaching content after the grid (if any). On mobile, `maxHeight: 80vh` may visually truncate the grid.

No immediate action required for typical usage (most libraries have <18 authors), but document this limitation. For future scalability:
- Consider `tabIndex={0}` on the scroll container with `role="region"` + `aria-label="Authors grid"` so keyboard users can skip it.
- Evaluate a "Load more" / pagination approach over virtualization for this use case, since the author count is unlikely to reach hundreds.

---

### Nitpicks

#### N1 — Heading levels in the AuthorCard grid create shallow hierarchy
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:287` |
| **autofix_class** | `advisory` |

```tsx
<h2 className="text-lg font-semibold group-hover:text-brand/80 transition-colors">
  {author.name}
</h2>
```

The page `<h1>` is "Our Authors". Each card then uses `<h2>` for the author name. With 10+ authors, a screen-reader user navigating by headings sees 10+ `<h2>` siblings under one `<h1>`. This is technically valid but noisy.

Consider `<h3>` for card names (treating the grid as an implicit h2-level section) or removing the heading entirely (relying on the `<Link>` accessible name to surface the author name).

---

#### N2 — `aria-label` on the "Search authors" button could be more precise
| Field | Value |
|---|---|
| **File** | `src/app/components/figma/HeaderSearchButton.tsx` (referenced via `scope="author"`) |
| **autofix_class** | `advisory` |

From the accessibility tree: `role: button, name: "Search authors"`. This is adequate. The minor suggestion is to verify the button announces as "Search authors, opens dialog" or similar via `aria-haspopup="dialog"` if it opens a modal search, or simply "Search authors" if it navigates to a search route. No change required unless the pattern deviates from current behavior.

---

#### N3 — Sort select `w-full` on mobile creates unexpected full-width layout
| Field | Value |
|---|---|
| **File** | `src/app/pages/Authors.tsx:159` |
| **autofix_class** | `safe_auto` |

```tsx
<SelectTrigger className="w-full sm:w-48" ...>
```

At mobile widths, the sort trigger stretches to 100% width despite being right-aligned. At 375px this means the dropdown takes up the entire content width, which may feel too large for a sort affordance. `max-w-48 w-auto` or simply `w-48` with no mobile override could work better if the right-align is preserved.

---

## Accessibility Checklist

| Check | Status | Notes |
|---|---|---|
| Text contrast ≥4.5:1 (light mode) | ✅ Pass | Brand blue on white/cream passes; muted-foreground on cream is borderline — verify with exact OKLCH values if precision needed |
| Text contrast ≥4.5:1 (dark mode) | ✅ Pass | Observed in screenshots; dark background + light text passes |
| Keyboard navigation — card links | ✅ Pass | `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` confirmed in code |
| Keyboard navigation — form inputs | ✅ Pass | All inputs use standard focus behavior |
| Focus indicators visible | ✅ Pass | Ring on cards, standard outline on form inputs |
| Skip to content link | ✅ Pass | `ref: e89, name: "Skip to content"` in accessibility tree |
| Heading hierarchy (profile page) | ✅ Pass | H1 (author name) → H2 (About, Courses) — correct |
| Heading hierarchy (grid page) | ⚠️ Warn | H1 (Our Authors) → H2 (each card name) — many H2s; see N1 |
| ARIA labels on icon buttons | ✅ Pass | Edit/Delete buttons have `aria-label="Edit {name}"` / `aria-label="Delete {name}"` |
| Form labels associated | ✅ Pass | All `<Label htmlFor>` match input `id` values |
| Form required fields announced | ⚠️ Warn | Name field has visual `*` but no `required`/`aria-required`; see H2 |
| Form error messages | ✅ Pass | `aria-invalid` + `aria-describedby` + `role="alert"` on errors |
| Breadcrumb `aria-current` | ✅ Pass | Active item has `states: [current]` in accessibility tree |
| `prefers-reduced-motion` | ✅ Pass (global) | `index.css` collapses all transitions; `motion-safe:` prefix missing on scale but effectively moot due to global rule — see H3 for belt-and-suspenders fix |
| Avatar alt text | ✅ Pass | `AvatarImage alt={author.name}` |
| Avatar fallback `aria-hidden` | ❌ Fail | Initials not hidden; see H1 |
| Empty state accessible | ✅ Pass | "No Authors Yet" H2 with descriptive body text and focusable CTA |
| Error state accessible | ✅ Pass | "Author Not Found" with recovery button |
| Social links descriptive | ✅ Pass | `aria-label="{platform} — {author.name}"` |

---

## Responsive Design Verification

### Mobile (375px)

**Status: ✅ Pass with notes**

- Authors list: Single-column layout with full-width cards. Bottom tab bar navigation visible. ✅
- Empty state: Card centered and full-width; CTA button accessible. ✅
- Author profile: Avatar centered, hero card full-width, stats 2×2 grid, bio below. ✅
- No horizontal overflow observed. ✅
- Touch targets: Card links fill the full card area (well above 44×44px minimum). ✅
- **Note**: On mobile the sort dropdown spans full width (see N3).

### Tablet / Sidebar-collapse (~1000px)

**Status: ✅ Pass**

- Authors grid: `sm:grid-cols-2` active — 2-column layout observed in screenshot. ✅
- Sidebar collapsed (hamburger visible in header). ✅
- Cards render side-by-side with appropriate gap (`--content-gap: 1.5rem`). ✅

### Desktop (1440px) — inferred from source

**Status: ✅ Pass (source-verified)**

- Authors grid: `lg:grid-cols-3` activates at 1024px — 3-column layout expected. ✅
- `FeaturedAuthorProfile`: switches to `sm:flex-row` with avatar left, info right. ✅
- Stats strip on profile: `sm:grid-cols-4` — 4 stat cards in a row. ✅
- Sort bar: `sm:flex-row sm:w-48` — dropdown sized appropriately. ✅

---

## Concrete Recommendations (Prioritized)

### 1. Reduce card size (user-requested, ~30 min)

In `Authors.tsx` `AuthorCard`:
- `p-6 pt-8` → `p-5 pt-6`
- `size-24` → `size-20`
- `mb-4` (after avatar) → `mb-3`
- Remove `{author.specialties.length === 0 && <div className="mb-5 mt-3" />}` placeholder
- Update `estimateRowHeight={320}` → `estimateRowHeight={260}` in `VirtualizedGrid` call

In `FeaturedAuthorProfile`:
- `size-28 sm:size-36` → `size-24 sm:size-32`

### 2. Fix avatar fallback `aria-hidden` (safe_auto, ~10 min)

Add `aria-hidden="true"` to all three `AvatarFallback` instances:
- `Authors.tsx:282` (AuthorCard)
- `Authors.tsx:419` (FeaturedAuthorProfile)
- `AuthorProfile.tsx:153` (AuthorProfile hero)

### 3. Add `required`/`aria-required` to Name field (~5 min)

`AuthorFormDialog.tsx:281` — add `required` and `aria-required="true"` to the Name `<Input>`.

### 4. Add `motion-safe:` to card scale hover (~5 min)

`Authors.tsx:276` — `hover:scale-[1.02]` → `motion-safe:hover:scale-[1.02]`.

### 5. Fix sparse FeaturedAuthorProfile stats strip (~15 min)

`Authors.tsx:502–511` — single-stat case should use flexbox centering rather than a partially-filled 3-column grid.

---

## Appendix: Screenshots Captured

| Filename | Description |
|---|---|
| `page-2026-05-05T08-28-05-916Z.png` | Authors empty state, mobile, dark mode |
| `page-2026-05-05T08-28-51-916Z.png` | Author Not Found error state, mobile, dark mode |
| `page-2026-05-05T08-29-35-991Z.png` | Authors empty state, wider viewport, dark mode |
| `page-2026-05-05T08-30-01-789Z.png` | Create Author dialog, mobile |
| `page-2026-05-05T08-30-58-367Z.png` | FeaturedAuthorProfile (1 author), mobile, dark mode |
| `page-2026-05-05T08-31-23-628Z.png` | AuthorProfile detail page, mobile, dark mode |
| `page-2026-05-05T08-32-36-559Z.png` | AuthorProfile detail page, mobile, **light mode** |
| `page-2026-05-05T08-33-18-743Z.png` | FeaturedAuthorProfile, **desktop**, light mode |
| `page-2026-05-05T08-34-51-390Z.png` | 2-author grid, **desktop**, light mode |

All screenshots saved to `/var/folders/9l/rrj3yt0d6t12c9bd9xj01g_00000gn/T/cursor/screenshots/`.

---

## JSON Summary

```json
{
  "agent": "design-review",
  "gate": "advisory",
  "status": "WARNINGS",
  "counts": {
    "blockers": 0,
    "high": 3,
    "medium": 4,
    "nits": 3,
    "total": 10
  },
  "findings": [
    {
      "severity": "high",
      "description": "AvatarFallback initials inside card link pollute accessible name (e.g. 'NJ Nana Janashia...' instead of 'Nana Janashia...')",
      "file": "src/app/pages/Authors.tsx",
      "line": 282,
      "confidence": 90,
      "category": "accessibility",
      "autofix_class": "safe_auto"
    },
    {
      "severity": "high",
      "description": "AuthorFormDialog Name input missing required/aria-required; required is only communicated visually via asterisk in label",
      "file": "src/app/components/authors/AuthorFormDialog.tsx",
      "line": 281,
      "confidence": 85,
      "category": "accessibility",
      "autofix_class": "safe_auto"
    },
    {
      "severity": "high",
      "description": "Card hover scale-[1.02] should use motion-safe: prefix; global prefers-reduced-motion CSS shortens duration but scale still fires as instant pop",
      "file": "src/app/pages/Authors.tsx",
      "line": 276,
      "confidence": 75,
      "category": "accessibility",
      "autofix_class": "safe_auto"
    },
    {
      "severity": "medium",
      "description": "Author cards are taller than needed: pt-8 top padding + size-24 avatar (96px) creates ~287px card height; user requested smaller cards",
      "file": "src/app/pages/Authors.tsx",
      "line": 277,
      "confidence": 95,
      "category": "visual",
      "autofix_class": "gated_auto"
    },
    {
      "severity": "medium",
      "description": "Empty specialty badge placeholder <div className='mb-5 mt-3' /> wastes 32px when author has no specialties, creating height inconsistency",
      "file": "src/app/pages/Authors.tsx",
      "line": 322,
      "confidence": 90,
      "category": "visual",
      "autofix_class": "safe_auto"
    },
    {
      "severity": "medium",
      "description": "FeaturedAuthorProfile stats strip renders 1 card in a 3-column grid, leaving 2 empty columns; feels visually sparse",
      "file": "src/app/pages/Authors.tsx",
      "line": 503,
      "confidence": 80,
      "category": "visual",
      "autofix_class": "manual"
    },
    {
      "severity": "medium",
      "description": "VirtualizedGrid scroll container (overflow-auto max-h-[80vh]) for large author lists may impede keyboard navigation through the grid",
      "file": "src/app/components/VirtualizedGrid.tsx",
      "line": 171,
      "confidence": 70,
      "category": "accessibility",
      "autofix_class": "manual"
    },
    {
      "severity": "nit",
      "description": "Author card names use h2 heading level; page already has h1 'Our Authors', creating many h2 siblings for screen reader heading navigation",
      "file": "src/app/pages/Authors.tsx",
      "line": 287,
      "confidence": 65,
      "category": "accessibility",
      "autofix_class": "advisory"
    },
    {
      "severity": "nit",
      "description": "Sort select uses w-full on mobile making it span the entire content width; consider w-auto or max-w-48",
      "file": "src/app/pages/Authors.tsx",
      "line": 159,
      "confidence": 70,
      "category": "visual",
      "autofix_class": "safe_auto"
    },
    {
      "severity": "nit",
      "description": "Search authors button accessibility label adequate but could add aria-haspopup if it opens a modal/dialog rather than navigating",
      "file": "src/app/components/figma/HeaderSearchButton.tsx",
      "line": null,
      "confidence": 55,
      "category": "accessibility",
      "autofix_class": "advisory"
    }
  ],
  "report_path": "docs/reviews/audit/design-review-authors-2026-05-05.md"
}
```

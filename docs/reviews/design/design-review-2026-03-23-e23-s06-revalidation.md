# Design Review Report — E23-S06: Re-Validation After Fix Commit

**Review Date**: 2026-03-23
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E23-S06 — Featured Author Layout For Single Author State
**Review Type**: Re-validation — checks whether findings from the initial review (same date) were addressed by commit `dd0123d2` ("fix(E23-S06): address all review findings") and `c9709da0`.
**Changed Files Re-examined**:
- `src/app/components/figma/FeaturedAuthor.tsx`
- `src/app/pages/Authors.tsx`

**Affected Route**: `/instructors` (renders `Authors.tsx`)
**Breakpoints Tested**: Mobile 375px, Tablet 768px, Desktop 1440px

---

## Executive Summary

The fix commit resolved the more impactful of the two previous MEDIUM findings (M2 — zero stats). Stats now render with real data across all three breakpoints. However, M1 (blockquote alignment on mobile) was not corrected in the fix commit — the `<blockquote>` still inherits `text-align: center` from its parent on mobile, confirmed by both computed style inspection and the full-page mobile screenshot. Additionally, a finding previously classified as a nitpick (N1 — brand Button `asChild` focus ring) is re-classified upward to MEDIUM in this review after confirming the `<a>` element receives zero visible focus indication (all shadow values are zero, outline is suppressed), which constitutes a WCAG 2.4.7 Level AA failure on the page's only interactive element.

No new issues were introduced by the fix commit.

---

## Previous Findings — Resolution Status

| ID | Original Severity | Description | Status |
|----|------------------|-------------|--------|
| M1 | MEDIUM | Blockquote `text-left` misaligns inside centred mobile layout | NOT RESOLVED |
| M2 | MEDIUM | Stats render as zero — seed author has no linked courses | RESOLVED |
| N1 | NIT | Pre-existing brand Button focus ring issue with `asChild` | RE-CLASSIFIED to MEDIUM |

---

## What Works Well

- Stats are fully populated at all three breakpoints: **8 Courses, 249h Content, 177 Lessons, 20y Experience**. The fix commit correctly linked the seed data (courses bear `authorId: 'chase-hughes'`, and the store's `getAuthorStats` now returns real values). This resolves M2 entirely.
- The `getInitials` import consolidation (from `@/lib/textUtils`, not `avatarUpload.ts`) is in place in both `FeaturedAuthor.tsx` and `Authors.tsx`.
- `transition-all` has been replaced with `transition-shadow transition-transform` on the multi-author grid cards in `Authors.tsx:53` — addressing the web design guidelines finding.
- `motion-safe:hover:scale-[1.02]` is in place on `Authors.tsx:53` — the `prefers-reduced-motion` guard is correctly applied.
- Zero console errors at all breakpoints. One pre-existing chart warning on another route is unrelated to this story.
- No hardcoded hex colours in either changed file (grep clean).
- Background token correct: `rgb(250, 245, 238)` = `#FAF5EE` confirmed at 375px, 768px, and 1440px.
- No horizontal scroll at any breakpoint (`scrollWidth: 364px, clientWidth: 375px` at mobile — no overflow).
- Heading hierarchy correct: H1 "Our Authors" → H2 "Chase Hughes", no skipped levels.
- Avatar `alt="Chase Hughes"` present. All stat-card icons carry `aria-hidden="true"`.
- Keyboard navigation reaches the CTA: Tab #21 from the top of the page reaches "View Full Profile". Enter key triggers navigation to `/authors/chase-hughes` — AC3 confirmed.
- The empty-state guard (`allAuthors.length === 0`) in `Authors.tsx` remains in place.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### Medium Priority (Should fix before merge)

#### M1 — Blockquote inherits `text-center` on mobile (unresolved from initial review)

**Location**: `src/app/components/figma/FeaturedAuthor.tsx:52-59`

**Evidence** — computed style inheritance chain at 375px viewport:
```
blockquote  .text-sm.italic.text-muted-foreground.border-l-2.border-brand.pl-3.mt-3
  textAlign: "center"   <-- inherits from parent

parent div  .flex-1.text-center.sm:text-left
  textAlign: "center"   <-- source of the inheritance
```

The `<blockquote>` has no `text-left` class applied. The fix commit noted in the story file ("Blockquote `text-left` misaligns inside centered mobile layout") referenced removing `text-left` from the blockquote — but the element never received a `text-left` class in the implementation reviewed here. The parent `div` uses `text-center sm:text-left` for its direct children (name, title), which is inherited by the blockquote. The result is a centred blockquote on mobile with a left border that points nowhere, creating a visually incoherent treatment.

**Observed behaviour at 375px**: The quote text "Understanding people is the most powerful skill you can develop." renders centred, while the `border-l-2 border-brand pl-3` left-border and left-padding push content rightward — the visual effect is a centred italic paragraph with extra left padding and a floating brand-coloured left border that does not align with anything.

**Impact**: The `<blockquote>` is a typographic anchor for the featured layout. Its left-border treatment is a visual cue of authority and emphasis. When the text is centred but the border is left-aligned, the treatment reads as broken to learners on mobile devices — eroding trust in the platform's finish at the exact moment the design is meant to impress with a hero layout.

**Suggestion**: Apply `text-left` directly to the blockquote (not the parent) so it is always left-aligned regardless of the parent's mobile centering, and make the border treatment unconditional:

```tsx
// FeaturedAuthor.tsx:52
<blockquote
  className="text-sm italic text-muted-foreground border-l-2 border-brand pl-3 mt-3 text-left"
  data-testid="featured-quote"
>
```

Alternatively, to fully embrace the mobile-centred layout, remove the `border-l-2 border-brand pl-3` classes on mobile and only apply them at `sm+`:

```tsx
<blockquote
  className="text-sm italic text-muted-foreground mt-3 sm:border-l-2 sm:border-brand sm:pl-3"
  data-testid="featured-quote"
>
```

Either approach resolves the inconsistency. The first is a one-token addition; the second changes the visual treatment but is arguably more intentional for mobile.

---

#### M2 (Re-classified from N1) — "View Full Profile" CTA has no visible focus ring

**Location**: `src/app/components/figma/FeaturedAuthor.tsx:105-107`, `src/app/components/ui/button.tsx:8`

**Evidence** — computed style when element is focused (Tab #21):
```
tag: "A"   (rendered via Button asChild)
outlineStyle: "none"
outlineWidth: "0px"
boxShadow: "rgba(0,0,0,0) 0px 0px 0px 0px, rgba(0,0,0,0) 0px 0px 0px 0px,
            rgba(0,0,0,0) 0px 0px 0px 0px, oklab(0 0 0 / 0) 0px 0px 0px 0px,
            rgba(0,0,0,0) 0px 0px 0px 0px"
```

The `Button` base class applies `outline-none` (suppresses native browser outline) and relies on `focus-visible:ring-[3px]` to provide a visible focus ring via Tailwind's `--tw-ring-shadow` box-shadow mechanism. When rendered via `asChild` as an `<a>` element, the Tailwind `focus-visible:` pseudo-class CSS is present in the stylesheet but computes to a zero-alpha shadow at runtime — the ring never becomes visible.

The `--ring` CSS variable resolves to `oklch(0.708 0 0)` (a near-neutral grey with zero chroma). Even if the ring shadow were rendering, this colour would have very low contrast against the brand blue button background (`bg-brand`), likely failing the 3:1 minimum for non-text focus indicators under WCAG 2.4.11.

**WCAG reference**: WCAG 2.4.7 (Focus Visible, Level AA) — "Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible." The "View Full Profile" CTA is the sole interactive element in the main content area of the page when a single author is shown. A keyboard user reaching it at Tab #21 has no visual confirmation of focus.

**Classification rationale**: The previous review noted this as N1 (nit, pre-existing platform issue). Re-classification to MEDIUM is warranted because: (a) this is the only interactive element in the main content area, making the impact higher than on a page with many focusable elements; (b) computed evidence confirms zero visible focus ring, not just a reduced-visibility ring; and (c) this story introduces the element — the fix commit was an opportunity to address it.

**Suggestion**: Add an explicit `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white` (or a ring using a contrasting token) directly on the `<Button>` in `FeaturedAuthor.tsx`, which will be passed through to the `<a>` via `asChild`:

```tsx
<Button
  variant="brand"
  asChild
  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
>
  <Link to={`/authors/${author.id}`}>View Full Profile</Link>
</Button>
```

A white outline on a blue background provides approximately 8:1 contrast — well above the 3:1 minimum for focus indicators. This is a targeted fix that does not require changes to the shared `Button` component.

---

### Nitpicks (Optional)

#### N1 — Bio paragraph left-aligns while other mobile content centres

**Location**: `src/app/components/figma/FeaturedAuthor.tsx:100-102`

**Evidence**:
```
bioTextAlign: "start"   (at 375px)
```

The short bio paragraph sits outside the hero section's `flex-1 text-center` div and has no explicit text-alignment class. It therefore defaults to `text-align: start` (left-aligned), while the name and quote above are centred. On mobile this creates a mixed alignment pattern: name and quote centred, bio left-aligned, CTA right-aligned.

**Impact**: Minor — the bio is not part of the centred hero section, so there is a design argument for left-aligning the paragraph as a reading unit. This is a subjective call. It is flagged for awareness rather than as a required fix.

**Suggestion**: If the design intent is a consistent centre-to-left flow on mobile, adding `text-center sm:text-left` to the bio `<p>` would align it with the hero section's behaviour. If the intent is to left-align body text as per the design principles ("left-aligned text for LTR languages"), leave as-is and treat the name/quote section's centering as a deliberate hero treatment.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast — author name (H2) | Pass | High contrast on card background |
| Text contrast — muted text (title, bio, stat labels) | Pass | Approx 4.3–4.7:1 on card and muted backgrounds, meets AA |
| Text contrast — badge text | Pass | Dark text on light secondary badge background |
| Keyboard navigation — CTA reachable | Pass | Reached at Tab #21; Enter key navigates to `/authors/chase-hughes` |
| Focus indicator — sidebar nav links | Pass | `outline: solid 2px` visible on all sidebar links |
| Focus indicator — View Full Profile CTA | FAIL | No visible focus ring (outline suppressed, box-shadow all zero). WCAG 2.4.7 |
| Heading hierarchy | Pass | H1 "Our Authors" → H2 "Chase Hughes", no skipped levels |
| ARIA labels on icon-only elements | Pass | All Lucide icons in StatCard carry `aria-hidden="true"` |
| Avatar alt text | Pass | `alt="Chase Hughes"` on `<AvatarImage>` |
| Semantic HTML — blockquote | Pass | Correct `<blockquote>` element for featured quote |
| Landmark regions | Pass | Pre-existing layout provides `<main>` and `<nav>` regions |
| No horizontal scroll — mobile 375px | Pass | scrollWidth (364px) ≤ clientWidth (375px) |
| No horizontal scroll — tablet 768px | Pass | No overflow detected |
| No horizontal scroll — desktop 1440px | Pass | No overflow detected |
| CTA touch target size | Pass | 137×44px — meets 44px minimum height |
| prefers-reduced-motion — FeaturedAuthor | Pass | No transform/transition animations on the featured card |
| prefers-reduced-motion — author grid cards | Pass | `motion-safe:hover:scale-[1.02]` correctly guards scale animation |
| Console errors | Pass | Zero errors across all tested viewports |
| Background colour token | Pass | `rgb(250, 245, 238)` = `#FAF5EE` at all breakpoints |
| Design tokens — no hardcoded colours | Pass | Grep clean on both changed files |

---

## Responsive Design Verification

### Desktop (1440px) — Pass

Full hero layout renders cleanly. Avatar (112px) left-aligned alongside name, title, featured quote with brand left-border, and five specialty badges. Stats strip in 4-column row with real values (8 / 249h / 177 / 20y). Bio paragraph below. "View Full Profile" CTA right-aligned at bottom-right of card. No overflow.

### Tablet (768px) — Pass

Layout switches to `sm:flex-row` — avatar and info side-by-side. Stats remain in 4-column row. No overflow. Content is readable despite the sidebar consuming approximately half the viewport width at this breakpoint (pre-existing layout behaviour, not introduced by this story).

### Mobile (375px) — Conditional Pass (M1 outstanding)

Single-column stacked layout. Avatar centred at 96px. Name and title centred. Specialty badges wrap and centre correctly. Stats grid is 2×2 (`gridTemplateColumns: "128px 128px"`). Bio text left-aligned below stats. "View Full Profile" CTA right-aligned at bottom. The blockquote centring inconsistency (M1) is visible in the full-page mobile screenshot: centred italic text with a left border and left padding that does not resolve meaningfully at this width.

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Single author shows featured hero layout | Pass | `data-testid="featured-author"` present; `data-testid="author-grid"` absent |
| AC2 | Multi-author path unchanged | Pass | Grid rendering path untouched in the diff |
| AC3 | Profile link navigates to `/authors/:authorId` | Pass | `href="/authors/chase-hughes"`, Enter key navigated to `http://localhost:5173/authors/chase-hughes` |
| AC4 | Responsive at 375px, 768px, 1440px | Pass | All three viewports tested; layouts correct; no overflow |
| AC5 | All styling uses design tokens | Pass | Zero hardcoded hex colours; all utilities use tokens |

---

## Recommendations

1. **Fix M1 (blockquote mobile alignment)** — add `text-left` directly to the `<blockquote>` element at `FeaturedAuthor.tsx:52`. This is a one-token change that resolves the visual incoherence of a centred italic quote with a left border at mobile widths. Estimated effort: 30 seconds.

2. **Fix the CTA focus ring (re-classified M2)** — add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white` to the `<Button>` in `FeaturedAuthor.tsx:105`. This gives keyboard users a clear white outline on the brand-blue button without touching the shared `Button` component. The "View Full Profile" CTA is the only interactive element in the featured layout's main content area — its focus visibility is disproportionately important.

3. **Consider the bio alignment (N1)** as a design decision — either centre it to match the hero section treatment on mobile, or document that body text is intentionally left-aligned per design principles. No code change required if the current left-align is intentional.

4. **The stats fix is solid.** The approach of linking courses by `authorId` to the store is the correct architectural choice. `getAuthorStats` correctly reads from the Zustand store's current state — no further changes needed.

---

*Review conducted via Playwright MCP with Chromium at viewports 375×812, 768×1024, 1440×900.*
*Computed styles verified programmatically. Screenshots saved to `/tmp/`.*

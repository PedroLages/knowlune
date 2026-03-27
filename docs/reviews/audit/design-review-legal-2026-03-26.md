# Design Review — Legal Pages Audit

**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright automation)
**Scope**: Full app audit — legal pages only (no story, no git diff)
**Pages Reviewed**: `/privacy` (Privacy Policy), `/terms` (Terms of Service)
**Source Files**:
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/legal/LegalLayout.tsx`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/legal/PrivacyPolicy.tsx`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/legal/TermsOfService.tsx`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/legal/LegalUpdateBanner.tsx`

---

## Executive Summary

Both legal pages are well-constructed standalone pages with clean information architecture, strong design token compliance, and good semantic markup. The layout correctly isolates legal content from the authenticated sidebar, uses appropriate landmarks, and degrades cleanly across all three breakpoints. Two significant issues require attention before these pages are considered production-ready: TOC and inline cross-page links suppress focus outlines without providing an alternative indicator (a WCAG 2.1 AA failure), and body text line length reaches ~123 characters at desktop — nearly double the 50–75 character readability guideline from the design principles.

---

## What Works Well

- **Design token compliance is exemplary.** Zero hardcoded hex colors or raw Tailwind palette classes found across all four files. Every color reference uses semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-brand`, `text-brand-soft-foreground`).
- **Landmark and semantic structure is correct.** The page uses `<header role="banner">`, `<main id="main-content">`, `<footer>`, `<article>`, `<section>`, `<address>`, and `<nav>` elements with appropriate ARIA labels. The heading hierarchy (H1 → H2 → H3) is clean and logical.
- **The update banner is an excellent component.** `LegalUpdateBanner` uses `role="alert"` + `aria-live="polite"`, hides decorative icons with `aria-hidden="true"`, provides a descriptive `aria-label` on the dismiss button, and enforces a 44x44px minimum touch target on the X button. The localStorage-based persistence correctly compares effective dates. The banner also dismisses cleanly.
- **Contrast ratios pass WCAG AA in both light and dark mode.** All key text pairs were verified:
  - Body text (light): 15.37:1
  - TOC links (light, on card): 7.59:1
  - Body text (dark): 14.12:1
  - TOC links (dark, on card): 6.67:1
  - Footer text (light muted): 5.57:1
  - Footer text (dark muted): 7.42:1
- **No horizontal overflow at any breakpoint.** Verified at 375px, 768px, and 1440px — scroll widths are within bounds on both pages.
- **No console errors** were detected during any page load.
- **Lazy-loading is correctly implemented.** Both pages use `React.lazy` via `Suspense` wrappers in `routes.tsx`, keeping the legal bundle out of the main app chunk.
- **The "Back to app" navigation button meets the 44px touch target** (`min-h-[44px]` applied, verified as 44px computed height on mobile).
- **Dark mode appearance is clean and consistent.** Background (`rgb(26, 27, 38)`), card (`rgb(36, 37, 54)`), and text (`rgb(232, 233, 240)`) all render correctly without any clipping, color bleed, or off-token values.

---

## Findings by Severity

### Blockers (Must fix before launch)

#### B-01 — Focus outline suppressed on TOC links and inline cross-page link

**Issue**: All table-of-contents anchor links use `focus-visible:outline-none` without providing a replacement focus indicator. Keyboard users navigating with Tab cannot see which link has focus.

**Location**:
- `PrivacyPolicy.tsx:51` — TOC links
- `TermsOfService.tsx:54` — TOC links
- `TermsOfService.tsx:81` — "Privacy Policy" inline link in Section 1

**Evidence**: Live keyboard test confirmed. When the first TOC link ("Information We Collect") receives focus after three Tab presses, `getComputedStyle(activeElement).outlineStyle` returns `"none"` and `outlineWidth` returns `"0px"`. The focus-ring screenshot shows no visible indicator on the focused link.

**Impact**: WCAG 2.1 SC 2.4.7 (Focus Visible) — AA failure. Legal pages are especially likely to be navigated by keyboard (users tabbing to specific sections, users with motor impairments reading terms before signing up). A missing focus indicator makes the TOC unusable without a mouse.

**Suggestion**: Replace the outline suppression with an underline-based approach that is clearly visible. The design already applies `hover:underline` — the `focus-visible` state should match or exceed this. One clean pattern:

```tsx
// Replace:
className="text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none"

// With (removes outline suppression, keeps underline as focus indicator but allows ring too):
className="text-brand-soft-foreground hover:underline focus-visible:underline"
```

If the default global ring (a 2px brand-colored outline) visually conflicts with the text style, a `rounded-sm` can be added, but the ring itself must not be suppressed.

---

### High Priority (Should fix before launch)

#### H-01 — Body text line length significantly exceeds readability guideline

**Issue**: The `max-w-4xl` container on `LegalLayout.tsx:30` constrains content to 896px wide. At 16px base font size, measured character-per-line count is approximately 123 characters — compared to the design principles guideline of 50–75 characters for body text.

**Location**: `LegalLayout.tsx:30` — `<div className="mx-auto max-w-4xl">`

**Evidence**: Canvas measurement via `ctx.measureText()` at desktop 1440px returned `paragraphWidth: 896` and `canvasCharsPerLine: 123`.

**Impact**: Long line lengths increase cognitive load and reading fatigue — particularly problematic for legal content that users need to read carefully. Studies on reading comprehension consistently show performance degrades above 80 characters per line. For a learning platform where attention and comprehension are core to the mission, this matters even on policy pages.

**Suggestion**: Constrain the text column width. The header and footer can remain `max-w-4xl` for visual balance, but the text content area should use a narrower constraint. A `max-w-prose` (65ch) wrapper around the body content, or switching to `max-w-2xl` (672px) for the main content column, would target approximately 75–85 characters per line. Example approach:

```tsx
// In LegalLayout.tsx, split the max-w constraints:
<main id="main-content" className="flex-1 px-6 py-8">
  <div className="mx-auto max-w-4xl">  {/* keeps wide TOC card */}
    <Outlet />
  </div>
</main>
```

And in the page components, body paragraphs could use `max-w-prose` while keeping section headings and cards at full column width.

#### H-02 — Logo link touch target too small on mobile

**Issue**: The Knowlune logo link in the header has a rendered height of 28px at mobile viewports, below the 44px minimum touch target requirement.

**Location**: `LegalLayout.tsx:16`

```tsx
<Link to="/" className="flex items-center gap-2" aria-label="Knowlune home">
  <KnowluneLogo />
</Link>
```

**Evidence**: `getBoundingClientRect()` at 375px viewport returns `height: 28` for the logo link. The `Back to app` button correctly has `min-h-[44px]` and measures 44px — the logo link does not.

**Impact**: Mobile users who tap the logo to return home may miss the target on the first attempt. At 28px tall, the tap target is 36% smaller than the minimum required. This is especially notable because the logo is the primary brand navigation element on an otherwise navigation-sparse page.

**Suggestion**: Add `min-h-[44px]` and align center to the logo link:

```tsx
<Link
  to="/"
  className="flex items-center gap-2 min-h-[44px]"
  aria-label="Knowlune home"
>
  <KnowluneLogo />
</Link>
```

#### H-03 — Footer navigation links lack aria-current on the active page

**Issue**: When a user is on `/privacy`, the "Privacy Policy" link in the footer navigation has no `aria-current="page"` attribute. The same applies to "Terms of Service" when on `/terms`. This means screen reader users cannot distinguish which legal page they are currently on from the footer navigation.

**Location**: `LegalLayout.tsx:40-45`

**Evidence**: Computed check confirmed `hasAriaCurrent: false` for both footer links. The `LegalLayout` is a shared wrapper with no awareness of which child route is active, so neither link gets the attribute.

**Impact**: Medium accessibility concern. Screen reader users who use the footer to understand page context will not hear "Terms of Service, current page" — they will hear two identical unlabeled links.

**Suggestion**: Use React Router's `useLocation` or `NavLink` (which applies `aria-current="page"` automatically) in the footer:

```tsx
import { NavLink } from 'react-router'

// In footer:
<NavLink
  to="/privacy"
  className={({ isActive }) =>
    `hover:text-foreground transition-colors ${isActive ? 'text-foreground font-medium' : ''}`
  }
>
  Privacy Policy
</NavLink>
```

`NavLink` applies `aria-current="page"` automatically when the route matches. This also provides a subtle visual active indicator for sighted users.

#### H-04 — Missing skip-to-main-content link

**Issue**: No skip link exists before the header navigation. Keyboard users must Tab through the logo and "Back to app" button on every page before reaching the main content.

**Location**: `LegalLayout.tsx` — missing skip link before `<header>`

**Evidence**: `document.querySelector('[href="#main-content"]')` returned `null`. The `main` element has `id="main-content"` which is the correct anchor target — the skip link is simply absent.

**Impact**: On long legal pages, keyboard users must navigate through 2–4 header elements before reaching content. While the `main` element correctly has an `id`, there is no mechanism to jump to it. This is a WCAG 2.4.1 (Bypass Blocks) concern.

**Suggestion**: Add a visually-hidden skip link as the first focusable element inside `<body>`:

```tsx
// At the top of LegalLayout.tsx return, before <header>:
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-brand"
>
  Skip to main content
</a>
```

---

### Medium Priority (Fix when possible)

#### M-01 — `prose-legal` class is applied but not defined

**Issue**: `PrivacyPolicy.tsx:61` applies `className="prose-legal space-y-4 text-foreground leading-relaxed"`. The class `prose-legal` does not exist in any CSS file in the project. No results were found when grepping all CSS and style files.

**Location**: `PrivacyPolicy.tsx:61`

**Evidence**: `grep -r "prose-legal" src/styles/` returned no results.

**Impact**: No visible rendering impact today — the undefined class is silently ignored by Tailwind/browsers. However, this is dead code that could confuse future developers who assume the class carries styling intent, and it will not appear in Tailwind's generated output even if a definition is added later without a source scan match.

**Suggestion**: Either define the class in `theme.css` or `index.css` if line-length or typography customization is intended (this would be a natural place to solve H-01), or remove it from the `className` string. The `TermsOfService.tsx` introduction block at line 64 does not have this class — the inconsistency reinforces that it was likely added speculatively.

#### M-02 — `address` element uses `rounded-xl` (14px) instead of `rounded-[24px]` design standard

**Issue**: Both `PrivacyPolicy.tsx:246` and `TermsOfService.tsx:247` apply `rounded-xl` (12px border radius) to the contact address cards. The design system specifies `rounded-[24px]` for card components.

**Location**:
- `PrivacyPolicy.tsx:246`
- `TermsOfService.tsx:247`

**Evidence**: Computed `borderRadius` returned `14px` (corresponding to `rounded-xl`). The TOC card `nav` element correctly uses `rounded-[24px]` and computed `24px`.

**Impact**: Minor visual inconsistency. The address block is a card-like container (bordered, padded, distinct background) and should visually match the TOC card radius. The 10px difference is subtle but noticeable when the two elements are on screen together.

**Suggestion**: Update both address elements to use `rounded-[24px]` to match the card standard, or use a card component if the project has one. The current `rounded-xl` creates an unintentional distinction between card-like elements on the same page.

#### M-03 — No print styles for long-form legal content

**Issue**: Neither the legal pages nor the global CSS define `@media print` styles. When a user prints either page for offline reading (common for legal documents), the header navigation, footer nav, and "Back to app" button will all print — wasting ink on navigation chrome that is non-functional on paper.

**Location**: `LegalLayout.tsx`, `src/styles/` — no `@media print` block found

**Evidence**: Print media emulation screenshot shows the full page including header and footer identical to screen view. No print-specific overrides were found via `grep -r "@media print" src/styles/`.

**Impact**: Low user impact day-to-day, but legal pages are among the most commonly printed web content. Users who print Terms of Service or a Privacy Policy for review or filing expect clean, ink-efficient output.

**Suggestion**: Add a print stylesheet (either in `index.css` or a new `legal.css` imported only in `LegalLayout`) that hides the header and footer during print and maximizes content width:

```css
@media print {
  header, footer { display: none; }
  main { padding: 0; }
  .max-w-4xl { max-width: none; }
}
```

#### M-04 — TOC list number styling is inconsistent between Privacy and Terms

**Issue**: The TOC `<ol>` uses `list-decimal list-inside` which displays numbers, but the visible anchor text strips numbers via `.replace(/^\d+\.\s/, '')`. This means the `<ol>` renders its own browser-generated numbers, creating duplicated numbering — "1. Information We Collect" becomes "1. Information We Collect" with the bullet "1." from the list and the text "1." removed, resulting in: `1. Information We Collect`. The section number is stripped from the link text but the `<ol>` counter adds it back. This is functionally fine but semantically odd.

**Location**: `PrivacyPolicy.tsx:46-57`, `TermsOfService.tsx:49-60`

**Evidence**: Code inspection: `{section.title.replace(/^\d+\.\s/, '')}` strips the number from the rendered anchor text, but `<ol className="list-decimal">` adds counter numbers from the browser.

**Impact**: Very minor. The rendered output looks correct. But the intent is ambiguous — if the goal was numbered links, the `<ol>` handles that; if the goal was clean text links inside a numbered list, the approach is correct. The only risk is if section numbering changes (e.g., a new section is inserted), the `<ol>` auto-numbering will still be correct but the stripped prefixes in `sections[]` data won't match.

**Suggestion**: Either remove `list-decimal` from the `<ol>` and keep section numbers in the link text (more predictable), or keep the current approach and document the intent. No urgent fix needed.

---

### Nitpicks (Optional)

#### N-01 — `role="banner"` is redundant on `<header>`

`LegalLayout.tsx:14` uses `<header role="banner">`. The `<header>` element already has an implicit ARIA role of `banner` when it is a direct child of `<body>` (or near-direct as a flex container child). Adding `role="banner"` explicitly is not wrong but is redundant per the HTML spec.

#### N-02 — The footer `<p>` with copyright could use a `<small>` element

The copyright notice at `LegalLayout.tsx:38` uses `<p>`. Semantically, `<small>` is the conventional element for legal/copyright text and communicates "fine print" to assistive technologies. This is a very minor semantic improvement.

#### N-03 — `LegalUpdateBanner` does not animate in/out

The banner mounts/unmounts without a transition. Given the design principles call for 150-200ms transitions on quick actions, a subtle fade could make the dismiss feel polished. This is optional and should respect `prefers-reduced-motion` if added.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 (light mode) | Pass | Body 15.37:1, links 7.00:1, muted 5.14:1 — all well above threshold |
| Text contrast >= 4.5:1 (dark mode) | Pass | Body 14.12:1, links 6.67:1, footer muted 7.42:1 |
| Keyboard navigation reachable | Pass | All interactive elements are Tab-reachable |
| Focus indicators visible | FAIL | TOC links and inline cross-links suppress outline via `focus-visible:outline-none` without replacement — see B-01 |
| Heading hierarchy | Pass | H1 > H2 > H3 — correct and logical |
| Landmark regions | Pass | header, main, footer, article, section, nav all present with correct semantics |
| ARIA labels on icon buttons | Pass | Dismiss button has `aria-label`, arrow and bell icons have `aria-hidden` |
| Decorative icons hidden from AT | Pass | All Lucide icons use `aria-hidden="true"` |
| Live region for dynamic content | Pass | Banner uses `aria-live="polite"` + `role="alert"` |
| aria-current on active nav link | FAIL | Footer nav links lack `aria-current="page"` — see H-03 |
| Skip-to-main-content link | FAIL | Not present — see H-04 |
| Form labels associated | N/A | No forms on these pages |
| Images have alt text | Pass | No non-decorative images; logo component is inline SVG/text |
| No horizontal scroll (mobile) | Pass | Verified at 375px: scrollWidth 364 < clientWidth 375 |
| Touch targets >= 44x44px | Partial | Back button: pass (44px). Logo link: fail (28px height) — see H-02. TOC links are text anchor links (17px height) — borderline but acceptable for inline text links per WCAG |
| prefers-reduced-motion | Pass | Global CSS in `index.css:306` and `tailwind.css:47` handle this |
| No auto-playing media | Pass | No media on these pages |
| Semantic HTML for address | Pass | `<address class="not-italic">` correctly used |
| time element for dates | Pass | `<time dateTime="2026-03-26">` used correctly |

---

## Responsive Design Verification

### Desktop (1440px)

Status: Pass with caveats

The pages render correctly with the full header, a comfortable amount of whitespace, and all sections visible. The `max-w-4xl` container centers content appropriately against the background. The update banner is clearly visible. The Table of Contents card looks well-proportioned at this width.

Caveat: Body text reaches ~123 chars per line at this viewport (see H-01). For a user reading the full Privacy Policy at 1440px, this will strain readability.

### Tablet (768px)

Status: Pass

Layout shifts cleanly. The content column fills available width with `px-6` padding on each side. The header flex layout remains a single row. Footer transitions correctly to `sm:flex-row` from stacked at this breakpoint. No clipping or overflow detected.

### Mobile (375px)

Status: Pass with one issue

Content stacks correctly to a single column. Footer transitions to `flex-col` centering copyright and nav links vertically. The `Back to app` button meets the 44px touch target. No horizontal scroll.

Issue: Logo link touch target is 28px tall (see H-02). TOC link touch targets measure 17px — technically below 44px, but these are inline text links within a list, which WCAG exempts from minimum target size when surrounded by adequate spacing.

---

## Code Health Analysis

### Design Token Compliance

Clean. No hardcoded hex colors, no raw Tailwind palette classes (`bg-blue-600`, `text-gray-500`, etc.) anywhere in the legal directory. All color usage is via semantic tokens.

### TypeScript Quality

`LegalUpdateBanner.tsx` has a well-typed `LegalUpdateBannerProps` interface. No `any` types found. Props are clearly defined.

### Import Conventions

All imports use the `@/` alias correctly. No relative `../` paths leaving the `pages/legal/` directory.

### Tailwind Usage

No inline `style=` attributes. All styling via Tailwind utilities. Responsive modifiers (`sm:flex-row`, `sm:text-4xl`) are used correctly where layout changes at breakpoints. One unused class found: `prose-legal` — see M-01.

### Orphaned / Unused CSS Class

`prose-legal` on `PrivacyPolicy.tsx:61` is not defined in any stylesheet. This is dead code.

---

## Recommendations (Prioritized)

1. **Fix the focus ring on TOC and inline links** (B-01). Remove `focus-visible:outline-none` from the three link class strings. This is a one-line fix per occurrence (3 total) and is the only WCAG AA failure in the codebase today.

2. **Reduce body text line length** (H-01). Consider wrapping the body prose content in a `max-w-prose` container while keeping the wider `max-w-4xl` for the TOC card and page container. This improves reading comfort for the longest document in the app.

3. **Fix logo touch target and add aria-current to footer nav** (H-02, H-03). The logo fix is `min-h-[44px]` on one link. The footer nav fix is switching from `<Link>` to `<NavLink>` which auto-handles `aria-current`.

4. **Add a skip-to-main-content link** (H-04). One hidden `<a>` element at the top of `LegalLayout` — a standard pattern that benefits all keyboard users and is quick to implement.

5. **Address the `prose-legal` dead class and `rounded-xl` on address** (M-01, M-02). Both are minor cleanup items that improve code clarity and visual consistency.

---

*Report generated by the design-review agent. Screenshots captured at 1440x900, 768x1024, and 375x812 viewports in both light and dark mode using Playwright. Contrast ratios computed from live computed style values via WCAG relative luminance formula.*

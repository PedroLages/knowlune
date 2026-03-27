# Design Review — Full App Audit: Authors, Notes, Challenges
**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright)
**Scope**: Full app audit — not a story review. No git diff; all four routes examined independently.
**Routes Audited**:
- `/authors` — Authors listing (single-author featured layout)
- `/authors/chase-hughes` — Author Profile page
- `/notes` — My Notes (empty state)
- `/challenges` — Challenges (empty state)
**Viewports Tested**: Desktop (1440px), Tablet (768px), Mobile (375px)
**Dark Mode**: Tested on all four routes
**Console Errors**: Zero

---

## Executive Summary

All four routes are polished and well-constructed, each demonstrating thoughtful responsive design and consistent use of the Knowlune design system. The app feels coherent — the same card patterns, typography scale, token usage, and spacing rhythm appear everywhere. The single-author featured layout on `/authors` is a highlight: it avoids the "one lonely card in a grid" problem elegantly. The main issues found are: (1) a **double-padding bug** on the Challenges page that indents content ~48px from the left edge instead of 24px, making it inconsistent with every other page; (2) **social links on Author pages have no accessible label** for screen readers; and (3) **Notes tab triggers are 29px tall** on mobile, below the 44px minimum. No WCAG AA contrast failures were found in either light or dark mode.

---

## What Works Well

1. **Featured author layout** — When exactly one author exists, the page switches to a rich hero layout instead of a sparse one-card grid. This is an excellent product decision. The blockquote, specialty badges, stats strip, and course list all combine into a genuinely compelling author page.

2. **Dark mode quality** — All four routes have properly tuned dark mode. The dark background (`rgb(26, 27, 38)`) gives excellent contrast ratios: H1 text achieves 14.12:1 and muted foreground text achieves 8.41:1, both far above the 4.5:1 WCAG AA requirement.

3. **Design token discipline** — No hardcoded hex colors or Tailwind palette shades appear in any of the four audited files (the one `bg-amber-500` hit is decorative progress bar fill on completed challenges — not text — so it does not affect contrast compliance, though it should still use `bg-warning`). The `warning` / `brand` / `brand-soft` / `muted-foreground` tokens are used correctly throughout.

4. **Loading and empty states** — Every route has a skeleton loader, a meaningful empty state with an icon, descriptive copy, and a CTA. The Challenges empty state correctly offers "Create Challenge" inline. The Notes empty state correctly links to "/courses". The Authors empty state provides "Add Your First Author".

5. **Keyboard and ARIA fundamentals** — All icon-only buttons have `aria-label`. Icon elements carry `aria-hidden="true"`. The note card collapse uses a `role="button"` div with `aria-expanded`, `tabIndex={0}`, and `onKeyDown` handling (Enter and Space). The notes tag filter group has `role="group"` and `aria-label`. Loading states use `aria-busy="true"` and `aria-label`. Focus rings are implemented via `focus-visible:ring-[3px]` on all shadcn/ui `Button` components.

6. **No horizontal scroll at any viewport** — Confirmed via `scrollWidth > clientWidth` check on all four routes at 375px. Mobile layouts stack cleanly.

7. **Progressive disclosure is intentional and correct** — Authors, Notes, and Challenges are hidden from the sidebar nav until their respective disclosure keys (`course-imported`, `note-created`, `challenge-used`) are unlocked. This is by design, not a missing nav entry.

---

## Findings by Severity

### Blockers (Must fix before merge)

None identified.

---

### High Priority (Should fix before merge)

#### H1 — Challenges Page Double-Padding
- **Location**: `src/app/pages/Challenges.tsx:180`
- **Evidence**: The outer `<div>` uses `className="mx-auto w-full max-w-4xl space-y-6 p-6"`. The Layout `<main>` already applies `p-6`. The measured gap from the main left edge to the challenges H1 is **144.5px** vs **24px** on every other page. The effective left indent is 48px (main p-6 + page p-6) plus the centering from `mx-auto` with `max-w-4xl` on a 1440px canvas, totalling ~144px.
- **Impact**: The page feels visually disconnected from the app chrome. On a 1440px desktop the content starts noticeably far from the left — 120px inset more than any other page. It also means the "Challenges" H1 is not horizontally aligned with the sidebar or header, breaking the visual grid.
- **Suggestion**: Remove `p-6` from the outer `<div>`. The Layout already provides consistent `p-6` padding. The `max-w-4xl` constraint is fine but should not carry its own padding. The correct className should be `"mx-auto w-full max-w-4xl space-y-6"`.

#### H2 — Social Links Lack Accessible Labels
- **Location**: `src/app/pages/Authors.tsx:493-506` and `src/app/pages/AuthorProfile.tsx:183-196`
- **Evidence**: Social links (website, twitter) render as plain text "website" and "twitter" with no `aria-label`. A screen reader user hears "website, link" — with no destination context. Additionally, the `ExternalLink` icon at `AuthorProfile.tsx:192` is missing `aria-hidden="true"` (unlike the correctly marked one at `Authors.tsx:500`).
- **Impact**: Screen reader users cannot distinguish "website" from "twitter" when links appear in a list without their surrounding visual context. This violates WCAG 2.4.6 (Headings and Labels) at the AA level.
- **Suggestion**: Add `aria-label={`${author.name}'s ${platform} profile`}` to each social link. For the external link icon in `AuthorProfile.tsx:192`, add `aria-hidden="true"`.

---

### Medium Priority (Fix when possible)

#### M1 — Notes Tab Triggers Below 44px Minimum on Mobile
- **Location**: `src/app/pages/Notes.tsx` — the `<TabsTrigger>` for "Notes" and "Bookmarks" tabs
- **Evidence**: Measured 115×29px (Notes tab) and 120×29px (Bookmarks tab) at 375px viewport. The 29px height is 15px below the 44px minimum touch target defined in the design principles.
- **Impact**: On small-fingered or accessibility-assisted mobile use, the tabs are difficult to tap accurately. This is particularly important for the Notes page which is a primary content destination.
- **Suggestion**: Add `className="h-11"` (44px) to the `<TabsList>` in Notes.tsx, or add `min-h-[44px]` to individual `<TabsTrigger>` elements. The tabs component should maintain visual design intent while expanding the tap surface.

#### M2 — Hardcoded `bg-amber-500` in Challenges Progress Bar
- **Location**: `src/app/pages/Challenges.tsx:102`
- **Evidence**: `className={cn('h-2.5', isCompleted && '[&>div]:bg-amber-500')}` — uses a hardcoded Tailwind palette color rather than the `warning` design token.
- **Impact**: `bg-amber-500` bypasses the theme system. In dark mode, the `--warning` token resolves to `oklch(0.72 0.15 75)` (a lighter amber appropriate for dark backgrounds), but `amber-500` is a fixed value that does not adapt. The ESLint `design-tokens/no-hardcoded-colors` rule should have caught this — worth verifying the rule covers `[&>div]:` arbitrary variant syntax.
- **Suggestion**: Replace with `[&>div]:bg-warning` to use the themed token. This preserves the semantic "completed = warm/gold" intent while respecting dark mode.

#### M3 — Inconsistent Card Border-Radius in Authors.tsx
- **Location**: `src/app/pages/Authors.tsx:288` (AuthorCard: `rounded-[24px]`) vs `src/app/pages/Authors.tsx:422` (FeaturedAuthorProfile hero card: `rounded-3xl`)
- **Evidence**: The AuthorCard grid uses `rounded-[24px]` (exactly matching the design token), while the FeaturedAuthorProfile uses `rounded-3xl` (which in Tailwind v4 defaults to 1.5rem = 24px). These are numerically equivalent in the default Tailwind config, but using two different spellings for the same value creates maintenance ambiguity. If the global border-radius token ever changes, only one of these will update.
- **Impact**: Low visual impact today since both compute to 24px, but medium maintenance risk. Consistent usage of `rounded-[24px]` throughout the file would make token-driven changes reliable.
- **Suggestion**: Standardize on `rounded-[24px]` in Authors.tsx and AuthorProfile.tsx to match the design system specification exactly and ensure token updates propagate correctly.

#### M4 — `ChallengeCard` Uses `<Card>` Without `border-0`
- **Location**: `src/app/pages/Challenges.tsx:61-64`
- **Evidence**: `<Card className={cn(isExpired && !isCompleted && 'opacity-60', isCompleted && 'border-warning/60 bg-warning/5')}>` — The base `<Card>` in the codebase uses a visible border by default. Other pages explicitly add `border-0` to cards (Authors, AuthorProfile, Notes all do). The Challenges card is the only one with a visible border in the audited set.
- **Impact**: Slight visual inconsistency — the ChallengeCard border style differs from author cards and note cards on other pages. In light mode the card appears slightly boxier. The `border-warning/60` override on completed cards also applies on top of the base border, making completed cards have two semi-transparent borders layered.
- **Suggestion**: Add `border-0` to the base ChallengeCard `<Card>` className. For completed cards, the `border-warning/60` accent can be re-added intentionally: `className={cn('border-0', isCompleted && 'border border-warning/60 bg-warning/5')}`.

#### M5 — Note Cards Use `border` While All Other Cards Use `border-0`
- **Location**: `src/app/pages/Notes.tsx:352`
- **Evidence**: `className="bg-card rounded-[24px] border p-4 transition-shadow hover:shadow-sm"` — the note cards render with a border. This is the opposite of the Authors and AuthorProfile cards which explicitly use `border-0`.
- **Impact**: Stylistically acceptable but inconsistent with the rest of the design. The note cards with border feel slightly form-like compared to the borderless cards elsewhere. In dark mode the border adds visual noise against the dark card background.
- **Suggestion**: If the border is intentional (to distinguish note cards from section cards), document this as a deliberate pattern. Otherwise, apply `border-0 shadow-sm` to match the rest of the design system's card usage pattern.

---

### Nitpicks (Optional)

#### N1 — Author Profile StatCard Uses `rounded-2xl` While Other Profile Cards Use `rounded-3xl`
- **Location**: `src/app/pages/AuthorProfile.tsx:311`
- **Evidence**: `<div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm">` — the stat strip cells use `rounded-2xl` (16px) while all surrounding cards use `rounded-3xl` (24px).
- **Impact**: Subtle but perceptible visual rhythm break in the stat strip. The cells feel slightly more angular than the cards they sit beneath.
- **Suggestion**: Consider `rounded-[24px]` or `rounded-3xl` to match the surrounding cards, or establish `rounded-2xl` as an intentional "inner card" pattern.

#### N2 — Notes Page `<h2>` Inside EmptyState Below `<h1>` — Hierarchy Is Fine But Inconsistent Source
- **Location**: `src/app/pages/Notes.tsx` — the `EmptyState` component renders an `<h2>` for "Start a video and take your first note"
- **Evidence**: The heading tree on `/notes` is: H1 "My Notes" → H2 "Start a video and take your first note". This is technically correct hierarchy (H1 → H2). However the same heading level (H2) in the Challenges empty state follows the same pattern. Both are fine. No change required.

#### N3 — Social Link ExternalLink Icon Missing `aria-hidden` in AuthorProfile
- **Location**: `src/app/pages/AuthorProfile.tsx:192`
- **Evidence**: `<ExternalLink className="size-3" />` — no `aria-hidden="true"`. The same icon in `Authors.tsx:500` correctly has `aria-hidden="true"`.
- **Impact**: Screen readers will attempt to describe the icon SVG (likely as an unlabeled image or empty string), adding noise. Severity is low since the icon has no semantic content to convey.
- **Suggestion**: Add `aria-hidden="true"` to match the pattern in Authors.tsx.

#### N4 — `Create Challenge` Button in Header Uses Default Variant, Not Brand Variant
- **Location**: `src/app/pages/Challenges.tsx:183`
- **Evidence**: `<Button data-testid="header-create-challenge" onClick={() => setDialogOpen(true)}>` — no `variant` prop, so it uses the default variant (typically outlined/secondary style). The empty-state CTA and Add Author button use `variant="brand"` for primary actions. Visually in the screenshots the header Create Challenge button appears to use the brand blue, so the default variant may be `brand` in this project's Button config.
- **Impact**: Depends on what `variant="default"` resolves to. If it renders blue, this is just a code clarity issue. If it ever resolves to something other than the brand CTA color, the primary action would lose hierarchy.
- **Suggestion**: Explicitly pass `variant="brand"` to document intent and match patterns in Authors.tsx.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | H1 text ~14:1, muted foreground ~8:1 on `#FAF5EE` |
| Text contrast ≥4.5:1 (dark mode) | Pass | H1 14.12:1, muted 8.41:1 on `rgb(26,27,38)` |
| Keyboard navigation — Tab order | Pass | Focus rings implemented via `focus-visible:ring-[3px]` on all buttons |
| Focus indicators visible | Pass | shadcn/ui Button and Link components carry ring focus styles |
| Heading hierarchy | Pass | H1 → H2 on all four routes; no heading levels skipped |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label` |
| Social links have ARIA labels | Fail | See H2 above — "website" / "twitter" links lack destination context |
| Semantic HTML | Pass | Nav, main, button (not div), breadcrumb, blockquote all used correctly |
| Form labels associated | Pass | Search inputs have `aria-label`; Switch has associated `<Label htmlFor>` |
| `prefers-reduced-motion` | Partial | Challenges collapsible chevron uses `motion-reduce:transition-none`; Authors card scale/shadow transition (`hover:scale-[1.02]`) does not have a `motion-safe:` or `motion-reduce:` guard |
| `aria-live` regions for dynamic content | Partial | Loading states use `aria-busy`. Filter results and note count badge have no `aria-live` announcement |
| `aria-current="page"` on active nav | Pass | Implemented in Layout.tsx `NavLink` component; confirmed in source at line 72 |
| No horizontal scroll at 375px | Pass | Verified via `scrollWidth > clientWidth` on all four routes |
| Touch targets ≥44px | Partial | Notes tabs: 29px tall (see M1). Course card "details" buttons are 28px but are hover-only (opacity-0) so they do not appear on touch devices |

---

## Responsive Design Verification

### Desktop (1440px)
- `/authors`: Pass. Featured author hero card fills width beautifully, stats strip, bio, and courses below in a clean 4-column grid. "Add Author" CTA correctly positioned top-right.
- `/authors/chase-hughes`: Pass. Stats strip renders as 4 columns (courses, content, lessons, experience). Breadcrumb correctly shows. Hero card, bio, and courses display in correct visual hierarchy.
- `/notes`: Pass. Empty state centered, tabs at correct height, sort and semantic search controls align right.
- `/challenges`: Partial — see H1 (double padding). Empty state itself renders correctly; the issue is the outer container's extra padding.

### Tablet (768px)
- `/authors`: Note — the onboarding dialog reappears at this viewport in the screenshot. Once dismissed, the featured author layout reflows to single-column (avatar centered above info) correctly.
- `/authors/chase-hughes`: Pass. Stats strip collapses gracefully. Text left-aligns at `sm:text-left`.
- `/notes`: Pass. Single-column layout, controls line up correctly.
- `/challenges`: Pass (minus the padding issue which persists at all viewports).

### Mobile (375px)
- `/authors`: Pass. Single column, avatar centered, specialty badges wrap naturally, "Add Author" button fits header row.
- `/authors/chase-hughes`: Pass. Breadcrumb and social links visible, stats strip is 2-column grid (appropriate for 375px).
- `/notes`: Pass. Bottom navigation present, tabs visible. Tab height issue (29px) identified as M1.
- `/challenges`: Pass. Empty state renders correctly in single column with appropriate wrapping.

---

## Dark Mode Verification

All four routes render cleanly in dark mode. The dark background `#1a1b26` is correctly applied (verified via computed `backgroundColor`). Card surfaces use the correct `--card` token (approximately `#23243a`). The theme toggle is accessible. No light-mode colors were found bleeding into dark mode.

One observation: in the dark mode screenshots, the Authors listing page shows the featured author card with a subtle but pleasant warm cast to the card edge — this is the `ring-2 ring-border/50` on the Avatar working correctly with dark border tokens.

---

## Code Health Summary

| Category | Status | Notes |
|----------|--------|-------|
| Hardcoded hex colors | Pass | Zero in audited files. Prototype files in `src/app/pages/prototypes/` have hardcoded colors but are not production routes |
| Hardcoded Tailwind palette shades | Partial | `bg-amber-500` in Challenges.tsx:102 (see M2) |
| Inline `style={}` attributes | Pass | None in any of the four audited files |
| `@/` import alias | Pass | All imports use `@/` consistently |
| TypeScript `any` types | Pass | Not found in audited files |
| `<div onClick>` patterns | Pass | The note card collapse uses `role="button"` with `tabIndex` and keyboard handler — not a raw div onClick |
| Missing `aria-label` on icon buttons | Pass | All icon-only buttons have labels |
| Missing `alt` on images | Pass | Avatar images use `alt={author.name}` |
| Console errors | Pass | Zero errors on any of the four routes |

---

## Recommendations

1. **Fix the Challenges double-padding immediately** (H1). It is a one-line fix (`remove p-6 from Challenges.tsx:180`) and makes the page visually consistent with every other route in the app. This is the highest-impact change for lowest effort.

2. **Add aria-labels to social links** (H2). Two-line change per file. Without it, screen reader users on author pages get no destination context for external links — a common accessibility gap that is quick to fix.

3. **Raise Notes tab height to 44px on mobile** (M1). The tabs are the primary navigation control on the Notes page. Increasing the minimum height to `h-11` in the TabsList or TabsTrigger is a single-line Tailwind change that meaningfully improves mobile usability.

4. **Replace `bg-amber-500` with `bg-warning`** (M2). Aligns with design token enforcement, ensures the color adapts correctly in dark mode, and keeps the codebase consistent with the established `warning` semantic token.

---

## Screenshots Reference

All screenshots captured at `http://localhost:5173` with onboarding wizard dismissed.

| File | Description |
|------|-------------|
| `/tmp/authors-listing-desktop.png` | /authors at 1440px (single-author featured layout) |
| `/tmp/author-profile-desktop.png` | /authors/chase-hughes at 1440px |
| `/tmp/notes-desktop.png` | /notes at 1440px (empty state) |
| `/tmp/challenges-desktop.png` | /challenges at 1440px (empty state) |
| `/tmp/authors-listing-tablet.png` | /authors at 768px |
| `/tmp/author-profile-tablet.png` | /authors/chase-hughes at 768px |
| `/tmp/notes-tablet.png` | /notes at 768px |
| `/tmp/challenges-tablet.png` | /challenges at 768px |
| `/tmp/authors-listing-mobile.png` | /authors at 375px |
| `/tmp/author-profile-mobile.png` | /authors/chase-hughes at 375px |
| `/tmp/notes-mobile.png` | /notes at 375px |
| `/tmp/challenges-mobile.png` | /challenges at 375px |
| `/tmp/authors-dark.png` | /authors dark mode |
| `/tmp/notes-dark.png` | /notes dark mode |
| `/tmp/challenges-dark.png` | /challenges dark mode |
| `/tmp/author-profile-dark.png` | /authors/chase-hughes dark mode |

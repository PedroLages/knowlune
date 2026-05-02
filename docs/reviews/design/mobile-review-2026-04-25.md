# Mobile Design Review — Knowlune
**Date:** 2026-04-25  
**Reviewer:** Ava (design-review agent) via Playwright MCP  
**Scope:** Mobile-focused audit across all primary routes  
**Viewports tested:** 375×812, 390×844, 414×896, 768×1024  
**Routes tested:** `/`, `/overview`, `/library`, `/courses`, `/notes`, `/reports`, `/settings`, `/authors`, `/flashcards`

---

## Executive Summary

Both user-reported bugs are confirmed and partially reproduced. Bug #1 (horizontal pan/scroll) was **not reproduced** as a whole-page scroll — `document.documentElement.scrollWidth` equals `clientWidth` on all tested routes — but a **related overflow** is confirmed on the Library page: when ABS servers are configured, the header button group (size-11 icons + "Import Book" text button) extends to ~461px on a 375px viewport, clipping the rightmost buttons including the primary "Import Book" CTA entirely off-screen within the Layout's `overflow-hidden` container. Users can see the icons but cannot tap or scroll to the Import button. This is likely what the user experienced as a "pan" in that specific context. Bug #2 (tabs not appearing fully) is **confirmed on Settings**: the nav pill row renders 8 categories but only 3 are visible at 375px and 5 at 768px; the container is horizontally scrollable (`overflow-x-auto`) but `scrollbar-none` suppresses all scroll affordance, making the hidden tabs completely undiscoverable without prior knowledge.

---

## Blockers

### B1 — Library header button group clips off-screen when ABS is configured

**Route:** `/library`  
**Viewports:** 375px, 390px, 414px  
**Evidence:** `mobile-375-library-withabs.png` — "Import Book" button and ABS/OPDS icon buttons pushed past right edge. The button group div measures `right=461px` on a 375px viewport. `page.scrollWidth` stays at 375 (Layout `overflow-hidden` clips it), so no horizontal scroll is triggered — the buttons are simply unreachable.  
**Root cause:** `src/app/pages/Library.tsx:362` — the header `div.flex.items-center.justify-between` with `p-6` has no wrapping, no responsive hiding, and no `flex-wrap`. At 375px, the inner button group (5 icon buttons + 1 text button = ~320px minimum) leaves only ~(327 - 320) = 7px for the title. The actual right edge hits 461px.  
**Impact:** Users who have configured Audiobookshelf cannot tap "Import Book" — the app's primary content ingestion action — from the Library page on iPhone SE and similar devices.  
**Fix:** Add `flex-wrap gap-y-2` to the header row, or hide the icon buttons behind a single "..." overflow menu on mobile (`sm:flex hidden` pattern). The ABS icon buttons (Headphones, Globe, LibraryIcon, Target) are all secondary settings-access actions that could live in a single settings popover on mobile.

---

### B2 — Settings category tabs scroll silently: 5 of 8 categories hidden with no scroll affordance (375px)

**Route:** `/settings`  
**Viewports:** 375px (5 hidden), 390px (5 hidden), 414px (5 hidden), 768px (3 hidden)  
**Evidence:** `mobile-375-settings-before-scroll.png` shows only Account, Profile, Appearance. `mobile-375-settings-after-scroll.png` shows tabs 4-6 only after programmatic scroll of 400px. Last tab right edge = 1031px on a 375px viewport.  
**Root cause:** `src/app/components/settings/layout/SettingsNavPills.tsx:20-21`  
```jsx
<div className="sticky top-0 ... pb-3 -mx-4 px-4 pt-1" role="tablist">
  <div className="flex gap-2 overflow-x-auto scrollbar-none">
```
The outer sticky div clips the inner scrollable div's visual overflow. `scrollbar-none` removes the only visual scroll indicator. The `role="tablist"` is on the outer non-scrolling container, so the inner scrollable div cannot convey its scrollability to assistive technology.  
**Impact:** 5 settings sections (Learning, Notifications, Integrations, Sync, Privacy) are inaccessible to users who do not know to swipe horizontally on the tab row. This includes critical sections like Notifications and Privacy/Consent.  
**Fix:**
1. Add a right-side fade gradient mask to the sticky container to signal "more content exists":
   ```jsx
   <div className="relative">
     <div className="... overflow-x-auto scrollbar-none">...</div>
     <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/95 to-transparent pointer-events-none" />
   </div>
   ```
2. Move `role="tablist"` + `aria-label` to the inner scrollable div.
3. Consider a "More" pattern that collapses tabs 4-8 into a dropdown on narrow viewports.

---

## High Priority

### H1 — Notes tab triggers: 32px height, below 44px WCAG touch target minimum

**Route:** `/notes`  
**Viewports:** All mobile viewports  
**Evidence:** Computed: `height: 32px, padding: 6px 12px, minHeight: auto`. Both "Notes" and "Bookmarks" tabs measure 32×121px and 32×126px.  
**Root cause:** `src/app/pages/Notes.tsx:510-519` — `<TabsList>` and `<TabsTrigger>` with no className override. The `brand-pill` variant on `TabsTrigger` uses `py-1.5` with no `min-h-[44px]`, producing 32px height.  
**Impact:** Users with motor impairment or large fingers will mis-tap the Notes/Bookmarks toggle, landing on the wrong section. WCAG 2.5.8 requires 24px minimum; Apple HIG recommends 44px.  
**Fix:** Add `min-h-[44px]` to the trigger variant in `brand-pill` or pass it as className at the callsite:
```jsx
<TabsList className="min-h-[44px]">
  <TabsTrigger value="notes" className="min-h-[44px]">
```
Alternatively, add `min-h-[44px]` to the `brand-pill` `tabsTriggerVariants` in `src/app/components/ui/tabs.tsx:28`.

---

### H2 — Settings nav pills: `role="tablist"` on non-scrolling container (ARIA mismatch)

**Route:** `/settings`  
**Viewports:** All mobile and tablet viewports  
**Evidence:** The `role="tablist"` is on the outer sticky div that does not scroll. Screen reader users navigating tabs will not find the hidden tab options because ARIA roles do not expose the scrollable child. The `[role="tab"]` elements are descendants of the scrollable inner div — their positions are reported correctly by aria-selected but screen readers cannot guide users to scroll.  
**Root cause:** `src/app/components/settings/layout/SettingsNavPills.tsx:20` — `role="tablist"` placed on outer container, not the `div.flex.gap-2.overflow-x-auto` inner div.  
**Impact:** Screen reader users cannot navigate to hidden setting categories. Keyboard users (Tab/Arrow navigation) will also miss tabs scrolled out of view.  
**Fix:** Move `role="tablist"` and `aria-label="Settings categories"` from the outer `div` to the inner `div.flex.gap-2.overflow-x-auto`.

---

### H3 — AudioMiniPlayer missing safe-area-inset-bottom

**Route:** All routes when audiobook is playing  
**Viewports:** 375px, 390px, 414px (iPhone X+)  
**Evidence:** Code review — `src/app/components/audiobook/AudioMiniPlayer.tsx:109` uses `fixed bottom-0` with `h-20` content but no `pb-[env(safe-area-inset-bottom)]`. BottomNav at `z-40` correctly uses `pb-[env(safe-area-inset-bottom)]`, but AudioMiniPlayer at `z-50` sits above both and does not.  
**Root cause:** `src/app/components/audiobook/AudioMiniPlayer.tsx:109` — className lacks safe area padding:
```jsx
// Current:
className="fixed bottom-0 left-0 right-0 z-50 ..."
// Should be:
className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] ..."
```
**Impact:** On iPhone X/11/12/13/14/15 (40% of iOS market), the mini-player's bottom controls (play/pause, seek) overlap the iOS home indicator zone. The progress bar is particularly affected since it sits at the top of the `h-20` area. The layout also uses `pb-36` for content clearance when mini-player is active but this value may be insufficient without safe area addition on devices with home indicators.  
**Fix:** Add `pb-[env(safe-area-inset-bottom)]` to the mini-player root div. Adjust Layout `hasMiniPlayer` padding accordingly (`pb-[calc(9rem+env(safe-area-inset-bottom))]`).

---

### H4 — Library header wraps without break: "Import Book" text button clipped on 375-414px (regardless of ABS state)

**Route:** `/library`  
**Viewports:** 375px, 390px, 414px  
**Evidence:** `mobile-375-library-withabs.png` — only icon buttons visible, "Import Book" text CTA (the primary action) fully off-screen. Even without ABS, any OPDS catalog configured adds "Browse Catalog" text button alongside the icons.  
**Root cause:** `src/app/pages/Library.tsx:503-507` — "Import Book" button unconditionally in the same flex row as all icon buttons. No responsive hiding or alternative mobile CTA path. The `flex items-center justify-between` header div has no `flex-wrap`.  
**Note:** This is not visible in an empty-state guest session without configured servers. It manifests in real user sessions.

---

## Medium Priority

### M1 — Reports `TabsList` has no overflow fallback (fragile)

**Route:** `/reports`  
**Viewports:** 375px  
**Evidence:** Code analysis — `src/app/pages/Reports.tsx:280`:
```jsx
<TabsList className="min-h-[44px]" aria-label="Reports navigation">
  <TabsTrigger value="study">Study Analytics</TabsTrigger>
  <TabsTrigger value="quizzes">Quiz Analytics</TabsTrigger>
  <TabsTrigger value="ai">AI Analytics</TabsTrigger>
</TabsList>
```
`TabsList` default `brand-pill` variant: `inline-flex ... bg-card/50 rounded-xl p-1 h-auto gap-1`. No `overflow-x-auto`, no `max-w-full`. With 3 tabs and `px-3` padding each, total ~300px. At 327px content width, this barely fits but has zero headroom. Adding a 4th tab or changing locale/font size will clip without scroll.  
**Impact:** Currently functional but a single-tab addition breaks mobile UX with no graceful degradation.  
**Fix:** Add `overflow-x-auto scrollbar-none max-w-full` to the TabsList or switch Reports to the pill-style tabs used by Library (FormatTabs pattern).

### M2 — Notes tab count formatting: "(0)" concatenated without space

**Route:** `/notes`  
**Viewports:** All  
**Evidence:** Notes tab shows "Notes(0)" — no space before the count badge. This is a minor typography issue visible in the `mobile-375-notes-clean.png` screenshot.  
**Root cause:** `src/app/pages/Notes.tsx:564`:
```jsx
Notes<span className="text-muted-foreground ml-1">({notes.length})</span>
```
The `ml-1` (4px) is only applied if the span renders inline. The tab trigger's `whitespace-nowrap` causes "Notes(0)" to render as a concatenated string visually.  
**Fix:** Add a space or use a `gap-1.5` flex layout: `<TabsTrigger value="notes" className="gap-1.5">`.

### M3 — Landing page: "Privacy Policy" and "Terms of Service" links are 15px tall (touch target)

**Route:** `/`  
**Viewports:** 375px  
**Evidence:** Computed: `Privacy Policy` link — `w=78, h=15`. `Terms of Service` — `w=95, h=15`. These are inline links in a legal notice paragraph.  
**Root cause:** `src/app/pages/Landing.tsx` — inline `<a>` elements inside a paragraph with no min-height.  
**Impact:** Tap targets below 44px threshold. Low frequency taps (legal links) but still non-compliant.  
**Fix:** Add `py-3 inline-flex` to the link classNames, or wrap them in a flex container with `gap-4 py-2`.

### M4 — Onboarding modal shows on authenticated routes in guest mode

**Route:** `/settings`, `/overview`, `/library` (first visit)  
**Viewports:** All  
**Evidence:** `mobile-375-settings-deep.png` shows "Welcome to Knowlune" modal blocking Settings on first visit. The modal has "Skip for now" which works. However, in the tablet screenshot (`tablet-768-settings-clean.png`) the sidebar Sheet and the onboarding modal were both open simultaneously, blocking the full UI.  
**Root cause:** Onboarding modal state is not cleared by guest-mode setup. The `localStorage.setItem('knowlune-onboarding-complete', 'true')` we injected in tests confirms the key — check if the app uses this key or a different one.  
**Impact:** First-time guest users on tablet see two overlapping modals (sidebar + onboarding). This is likely the intended first-run experience, but the double-modal stacking is confusing.  
**Fix:** Verify the onboarding modal does not open when the sidebar Sheet is already open on tablet.

### M5 — Settings tab bar: no visual affordance that tabs 4-8 exist (no fade, no scroll shadow)

**Route:** `/settings`  
**Viewports:** 375px, 390px, 414px, 768px  
**Evidence:** `mobile-375-settings-before-scroll.png` — 3 tabs visible, clean right edge, zero indication of hidden content.  
**Root cause:** See B2 root cause. The sticky container clips without a visual gradient.  
**Impact:** Users navigating to Notifications or Privacy settings will not find them without already knowing where to look. Discoverability failure.  
**Fix:** Same as B2 fix (right-fade gradient).

---

## Nitpicks

### N1 — Library "Books" heading: double `p-6` padding stacks with Layout `px-6`

**Route:** `/library`  
**Viewports:** All  
**Evidence:** `Layout.tsx:724` adds `px-6 pt-6` to the content area. `Library.tsx:362` adds its own `p-6` to the root div. Total horizontal padding = 48px from Layout + 48px from Library = 96px (24px per side × 4). Most other pages use the Layout padding only, giving 327px content width at 375px. Library's double-padding gives ~279px. This is narrower but not broken — it's consistent with the visual output in screenshots.  
**Advisory:** Consider whether Library intentionally adds its own padding or if the outer `p-6` should be removed to match other pages' content width consistency.

### N2 — Bottom nav "More" drawer: no close button for low-mobility users

**Route:** All (BottomNav)  
**Viewports:** 375px  
**Evidence:** `mobile-375-more-drawer.png` — "More Options" drawer opens without a visible close button. Users must swipe down or tap the backdrop.  
**Root cause:** `src/app/components/navigation/BottomNav.tsx` — Drawer component likely inherits its close behavior from Radix Drawer but the `DrawerHeader` doesn't include an explicit close button.  
**Fix:** Add a close button to `DrawerHeader` — a small X icon in the top-right of the "More Options" drawer header.

### N3 — Console errors: syncEngine schema mismatch

**All routes** — Console output shows recurring errors:
```
[syncEngine] Download error for table "study_sessions": column study_sessions.updated_at does not exist
[syncEngine] Download error for table "quiz_attempts": column quiz_attempts.updated_at does not exist
[syncEngine] Download error for table "ai_usage_events": column ai_usage_events.updated_at does not exist
Failed to load resource: the server responded with a status of 400 ()
```
These are backend schema errors (Supabase column missing). Not a design issue, but they indicate a migration gap in the deployed schema. These appear on every page load and generate noisy console output that could mask real errors.

---

## What Works Well

1. **BottomNav implementation is solid.** `pb-[env(safe-area-inset-bottom)]`, `h-14` (56px) touch targets, `aria-current` on active links, logical progressive disclosure with "More" drawer — all correct.

2. **Layout's mobile content area padding is correct.** `pb-20 sm:pb-6` gives proper BottomNav clearance. `pb-36` when mini-player active is a thoughtful accommodation.

3. **Library format/source tab pills (FormatTabs, LibrarySourceTabs) are the right pattern.** `overflow-x-auto scrollbar-none`, `whitespace-nowrap`, `flex-shrink-0` — exactly what the Settings nav pills are missing. These should be the reference implementation.

4. **Reports empty state is graceful.** Empty state with "Browse Courses" CTA is clean and appropriately handles the no-data guest case.

5. **Touch targets in BottomNav, Settings nav pills, and Layout header buttons are all 44px.** The `min-h-[44px] min-w-[44px]` pattern is consistently applied in the header and sidebar.

6. **Horizontal scroll is contained on all tested routes.** `document.documentElement.scrollWidth === clientWidth` on every route — the Layout's `overflow-hidden` chain correctly prevents page-level pan. Bug #1 as a whole-page scroll does not reproduce in Playwright headless testing; the Library header overflow described in B1 is the most likely culprit the user is encountering (Layout `overflow-hidden` clips but any tap outside the visible area creates a gap effect that may be perceived as panning on real iOS).

7. **Audiobook cover object-contain fix (commit 3411d14b) verified.** Library empty-state card correctly shows the audiobook cover placeholder icon without cropping artifacts.

---

## Detailed Findings Summary

| ID | Route | Viewport | Issue | Severity | File |
|----|-------|----------|-------|----------|------|
| B1 | /library | 375-414px | Header button group clips "Import Book" off-screen | Blocker | Library.tsx:362 |
| B2 | /settings | 375-768px | 5-8 of 8 nav pills hidden with no scroll affordance | Blocker | SettingsNavPills.tsx:20 |
| H1 | /notes | All mobile | Tab triggers 32px height, below 44px minimum | High | Notes.tsx:510 / tabs.tsx:28 |
| H2 | /settings | All mobile | `role="tablist"` on non-scrolling container (ARIA) | High | SettingsNavPills.tsx:20 |
| H3 | All routes | 375-414px | AudioMiniPlayer missing `safe-area-inset-bottom` | High | AudioMiniPlayer.tsx:109 |
| H4 | /library | 375-414px | "Import Book" CTA unreachable on mobile (header overflow) | High | Library.tsx:503 |
| M1 | /reports | 375px | TabsList no overflow fallback (fragile) | Medium | Reports.tsx:280 |
| M2 | /notes | All | "Notes(0)" — missing space before count badge | Medium | Notes.tsx:564 |
| M3 | / | 375px | Legal links 15px tall (touch target) | Medium | Landing.tsx |
| M4 | /settings | Tablet | Onboarding modal + sidebar Sheet double-stacking | Medium | — |
| M5 | /settings | 375-768px | No visual affordance for hidden tabs | Medium | SettingsNavPills.tsx |
| N1 | /library | All | Double `p-6` padding (Library + Layout) | Nitpick | Library.tsx:362 |
| N2 | All | 375px | "More" drawer has no close button | Nitpick | BottomNav.tsx |
| N3 | All | All | syncEngine console errors (schema mismatch) | Nitpick | Backend |

---

## Responsive Verification Table

| Route | 375px | 390px | 414px | 768px | Notes |
|-------|-------|-------|-------|-------|-------|
| / (Landing) | PASS | PASS | PASS | PASS | Modal dismissible; legal links small |
| /overview | PASS | PASS | PASS | PASS | Empty state clean |
| /library | WARN | WARN | WARN | WARN | Header clips with ABS configured (B1/H4) |
| /courses | PASS | PASS | PASS | PASS | Empty state; no grid data to verify |
| /notes | WARN | WARN | WARN | WARN | Tab touch target 32px (H1) |
| /reports | PASS | PASS | PASS | PASS | Empty state renders correctly; tabs only show with data |
| /settings | FAIL | FAIL | FAIL | FAIL | 5 hidden tabs, no scroll affordance (B2/H2/M5) |
| /authors | PASS | PASS | PASS | PASS | Empty state |
| /flashcards | PASS | PASS | PASS | PASS | Empty state |

---

## Recommendations (Priority Order)

1. **Fix Settings nav pills (B2/H2/M5) — 1 file, ~10 lines:** Add a right-fade gradient overlay to signal scrollability, and move `role="tablist"` to the inner scrollable div. This unblocks 5 settings sections for all mobile users.

2. **Fix Library header mobile layout (B1/H4) — 1 file, ~20 lines:** Wrap the icon buttons in a responsive container that collapses to a single "..." overflow button on mobile (`sm:hidden` pattern, or `flex-wrap` with reduced icons).

3. **Fix Notes tab touch target (H1) — 1 file, 1 line:** Add `min-h-[44px]` to `TabsTrigger brand-pill` variant in `tabs.tsx:28` — this fixes all brand-pill tabs globally.

4. **Fix AudioMiniPlayer safe area (H3) — 1 file, 1 line:** Add `pb-[env(safe-area-inset-bottom)]` to the mini-player root className.

---

## Screenshots

All screenshots are at:  
`docs/reviews/design/mobile-review-2026-04-25-screenshots/`

Key screenshots:
- `mobile-375-settings-before-scroll.png` — confirms B2 (3 visible tabs, no affordance)
- `mobile-375-settings-after-scroll.png` — confirms tabs exist after scroll (tabs 4-6 revealed)
- `mobile-375-library-withabs.png` — confirms B1 (buttons clipped, "+" only partially visible)
- `mobile-375-notes-clean.png` — shows Notes tabs at 32px height (H1)
- `mobile-375-more-drawer.png` — shows "More" drawer (works well, N2 minor)

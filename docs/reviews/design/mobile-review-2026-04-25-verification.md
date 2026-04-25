# Mobile Design Review — Re-verification
**Date**: 2026-04-25
**Reviewed by**: Ava (design-review agent, Playwright MCP)
**Commit verified**: `da278037` "fix(mobile): course thumbnail fallback, local-course mobile UX, ABS sync hint"
**Scope**: Targeted re-verification of 4 reported fixes. Not a full re-audit.
**Screenshots**: `docs/reviews/design/screenshots-mobile-verify-2026-04-25/`

---

## Verification Table

| Fix | Description | Status | Evidence |
|-----|-------------|--------|----------|
| 1 | Settings nav pills — scroll, fade gradient, `role="tablist"`, 44px height | ⚠️ Partial | See below |
| 2 | Library header — 3-dot overflow on mobile, Import CTA visible, desktop intact | ✅ Fixed | `fix2-lib-375.png`, `fix2-lib-375-menu.png`, `fix2-lib-1024.png` |
| 3 | Tab min-height ≥44px (`brand-pill` + `underline` variants) | ✅ Fixed | `fix3-notes-375.png` |
| 4 | Layout safe-area padding — no overflow, `calc()` intact | ✅ Fixed | `fix4-overview-375.png`, `fix4-library-375.png` |

---

## Fix-by-Fix Evidence

### Fix 1 — Settings nav pills (`/settings`, 375px) — PARTIAL

**What works:**
- `role="tablist"` is on the scrollable container element. ✅
- `aria-label="Settings categories"` is set. ✅
- All 8 pills render with `height: 44px`. ✅
- Horizontal scroll works: `scrollWidth 1007px > clientWidth 327px`. ✅
- Fade gradient span renders at `32×44px` with correct `linear-gradient(to left …)` background. ✅
- Tab key successfully walks through all 8 pills (all have `tabIndex=0`). ✅

**What doesn't work:**
- **ArrowLeft / ArrowRight keys do nothing.** The `SettingsNavPills` component attaches `role="tablist"` and `role="tab"` on raw `<button>` elements but implements no `onKeyDown` handler. All 8 buttons have `tabIndex=0` (flat tab order) instead of the ARIA roving-tabindex pattern (`tabIndex=0` only on the active tab, `-1` on the rest). After clicking the first pill and pressing ArrowRight 8 times, focus stays on "Account" every time.

**Why this matters**: WCAG 2.1 Success Criterion 2.1.1 (Keyboard) + the WAI-ARIA tablist pattern both require that arrow keys move focus within a tablist. Screen reader users on iOS VoiceOver and Android TalkBack use swipe-based focus traversal that maps to arrow-key events. Users navigating by keyboard can reach all pills via Tab, so functional parity exists — but the ARIA contract is broken. This is a **Medium** severity gap, not a blocker (Tab works, pills are reachable), but it should be resolved to honour the stated `role`.

**Reproducing steps**: Navigate to `/settings` at 375px. Click "Account" pill. Press ArrowRight. Focus stays on "Account".

---

### Fix 2 — Library header mobile overflow (`/library`, 375px and 1024px) — FIXED ✅

At 375px:
- 3-dot `MoreVertical` trigger is visible and tappable (`44×44px`). ✅
- Tapping it opens a Radix `DropdownMenu` with 4 items: Audiobookshelf, OPDS Catalogs, Manage Shelves, Reading Goals. ✅
- Primary "+ Import" CTA remains visible alongside the 3-dot trigger (`100×44px`). ✅
- Desktop secondary icon buttons (ABS, OPDS, Shelves) have `width: 0` at 375px — correctly hidden via `hidden sm:contents`. ✅
- No horizontal scroll. ✅

At 1024px (regression check):
- 3-dot trigger has `display: none`, `width: 0` — correctly hidden. ✅
- Desktop secondary buttons (ABS, OPDS, Shelves) are `44×44px` — correctly visible. ✅
- Layout looks identical to pre-fix (screenshot: `fix2-lib-1024.png`). ✅

**One minor observation**: The overflow menu at 375px does not include a "Browse Catalog" item because no OPDS catalogs are configured in guest mode. This is correct conditional rendering (`opdsCatalogs.length > 0`), not a bug.

---

### Fix 3 — Tab min-height ≥44px — FIXED ✅

At `/notes` (375px, `brand-pill` variant):
- "Notes" tab: `44px`. ✅
- "Bookmarks" tab: `44px`. ✅

The `tabs.tsx` `min-h-[44px]` token is applied to all three variants (`default`, `brand-pill`, `underline`) in `tabsTriggerVariants`. Code inspection confirms the `underline` variant also includes `min-h-[44px]`. Could not load a course detail page in guest+empty-data mode to verify underline tabs live, but the CSS definition is correct and the token is present in the compiled output.

---

### Fix 4 — Layout safe-area padding — FIXED ✅

At 375px on both `/` (Overview) and `/library`:
- The main `<MAIN>` element reports `padding-bottom: 80px` (computed), confirming the `calc(theme(spacing.20) + env(safe-area-inset-bottom))` resolves correctly in a non-iOS browser (where `env()` returns `0`, leaving `80px = 5rem`). ✅
- With a `hasMiniPlayer` active the class switches to `pb-[calc(theme(spacing.36)+env(safe-area-inset-bottom))]` = `144px + safe-area`. The conditional logic is correct in source (`Layout.tsx:724`). ✅
- No horizontal overflow on either route. ✅
- The `sm:pb-20` / `sm:pb-6` fallbacks are present for desktop. ✅

Full iOS safe-area clearance cannot be verified in Chromium headless (no real notch), but the `env()` plumbing is correct. No visual regression observed on regular mobile.

---

## Regressions Found

None from the library, tabs, or layout fixes.

---

## New Issue Surfaced

**Issue**: Settings nav pills — missing roving-tabindex + ArrowLeft/Right keyboard handler
**Severity**: Medium (not a blocker — Tab key covers functional access; ARIA contract is incomplete)
**File**: `src/app/components/settings/layout/SettingsNavPills.tsx`
**Category**: Accessibility (WCAG 2.1 SC 2.1.1, WAI-ARIA Tabs pattern)
**autofix_class**: `manual` (requires adding `onKeyDown` handler + roving tabIndex logic to the component)

**Suggested fix**: Add a `onKeyDown` handler to the tablist `<div>` that intercepts ArrowRight/ArrowLeft, finds the next/previous `[role="tab"]` sibling, calls `.focus()` on it, and scrolls it into view. Update each button's `tabIndex` to `isActive ? 0 : -1` so only the active pill is in the natural tab stop.

```tsx
// Minimal roving-tabindex sketch
const handleKeyDown = (e: React.KeyboardEvent) => {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')]
  const idx = tabs.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowRight' && idx < tabs.length - 1) {
    e.preventDefault(); tabs[idx + 1].focus(); tabs[idx + 1].scrollIntoView({ inline: 'nearest' })
  }
  if (e.key === 'ArrowLeft' && idx > 0) {
    e.preventDefault(); tabs[idx - 1].focus(); tabs[idx - 1].scrollIntoView({ inline: 'nearest' })
  }
}
// On each button: tabIndex={isActive ? 0 : -1}
```

---

## Sign-off

Fixes 2 (library header), 3 (tab heights), and 4 (safe-area layout) are solid and can be considered closed. Fix 1 (settings pills) is **partially closed**: the visual improvements (scroll, fade gradient, 44px height, correct tablist placement) all land correctly, but the `role="tablist"` ARIA contract is incomplete because ArrowLeft/Right keyboard navigation was not implemented — only the role attributes were added. Tab-key access works and covers all 8 pills, so this is not a merge blocker, but it should be tracked as a follow-up Medium accessibility task to complete the roving-tabindex pattern.


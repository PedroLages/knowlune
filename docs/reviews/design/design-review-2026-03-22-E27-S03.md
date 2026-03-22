# Design Review: E27-S03 — Update Sidebar Links to Reports Tabs

**Date:** 2026-03-22
**Story:** E27-S03
**Reviewer:** design-review agent (Playwright MCP)
**Viewports tested:** 375px (mobile), 768px (tablet), 1440px (desktop)
**App URL:** http://localhost:5173

---

## Summary

2 Blockers | 2 High | 1 Medium

---

## Blockers

### [Blocker] BottomNav strips `?tab=` from all three analytics links — `BottomNav.tsx:84`

`<Link to={item.path}>` uses only the path (`/reports`), not `item.path + ?tab=item.tab`. All three analytics links on mobile navigate to bare `/reports`, not to the intended tab. This means the core feature (linking to a specific tab) does not work on mobile.

### [Blocker] BottomNav marks all three analytics items simultaneously active — `BottomNav.tsx:16–18, 79`

The local `isActive` function checks only `location.pathname.startsWith(path)` without any `location.search` awareness. On any `/reports` URL, all three analytics items appear highlighted simultaneously. Visually broken; violates the AC requiring "other Reports tab items appear inactive."

---

## High Priority

### [High] Duplicate `key={item.path}` causes React errors — `Layout.tsx:122`, `BottomNav.tsx:82`

All three Reports items share `path: '/reports'`. React emits key collision warnings on every render in both the desktop sidebar and mobile drawer. This produces unpredictable DOM reconciliation.

### [High] Tablet sidebar sheet missing `SheetTitle` — `Layout.tsx:338`

The `<SheetContent>` used for the tablet navigation drawer is missing a `<SheetTitle>` (or `asChild` with an accessible title). Radix emits a `DialogTitle` accessibility error with a dangling `aria-labelledby` reference. Screen readers announce the sheet with no accessible name.

**Fix:** Add `<SheetTitle className="sr-only">Navigation</SheetTitle>` inside the `SheetContent`.

---

## Medium

### [Medium] Three analytics links visually identical to sibling items — no hierarchy signal

"Study Analytics", "Quiz Analytics", and "AI Analytics" appear at the same indent, size, and weight as "Challenges" and "Session History" in the Track group. There is no visual cue (indent, smaller text, separator, or label) that these three are sub-tabs of a single page rather than independent destinations.

**Fix (optional):** Consider a slight indent (`ml-2`), a `text-sm` size, or a thin left-border accent to group the three tab-links visually under an implied "Reports" parent — consistent with common sub-navigation patterns.

---

## What Works Well

- **Desktop active state**: `getIsActive()` and `NavLink` work correctly. Active tab link is highlighted, inactive tabs are not. Correct `aria-current="page"` attribute observed in DOM.
- **Desktop link generation**: All three links correctly produce `/reports?tab=study`, `/reports?tab=quizzes`, `/reports?tab=ai`.
- **Bare `/reports` default**: "Study Analytics" is correctly highlighted when navigating to `/reports` without a tab param.
- **Tooltip in collapsed mode**: Icon-only sidebar shows correct tab names in tooltips.

# Design Review: E50-S04 — Calendar Settings UI

**Date**: 2026-04-04
**Story**: E50-S04 — Calendar Settings UI
**Viewport tested**: Desktop (1440px via Playwright MCP)
**Tester**: Claude Sonnet 4.6 via Playwright MCP

## Summary

The Calendar Integration section renders correctly and integrates seamlessly with the existing Settings page design patterns. The disabled state is clear and informative. The component uses all correct design tokens. No visual blockers detected.

## What Works Well

- Card-based layout matches existing Settings sections (Account, Profile, Reminders)
- Brand-soft circle icon treatment is consistent with other section headers
- Toggle placement (top-right of card header) matches existing Notification Preferences patterns
- Disabled state shows a centered empty-state with the Calendar icon and explanation text — clear and informative
- "You must be signed in to enable the calendar feed" error toast fired correctly on toggle attempt without auth
- No horizontal overflow or layout breaks observed

## Findings

### MEDIUM — Calendar Section Not Visible Without Scrolling (AC1 discoverability)

The Calendar Integration section is positioned far down the Settings page (after Course Reminders, AI Configuration is next). Users must scroll significantly to discover it. There is no Settings table-of-contents or jump navigation.

**Why it matters**: Feature discoverability. Users who want to set up calendar sync must scroll through ~8 other sections to find it.

**Recommendation**: Consider adding a "Jump to section" anchor list at the top of Settings, or grouping Calendar Integration earlier in the page near Notifications. Low priority — not a UI bug, but a UX improvement worth tracking.

### LOW — Disabled Toggle Color Has Insufficient Contrast (Dark Mode)

In dark mode, the disabled toggle switch renders with very low contrast against the card background. This may fail WCAG AA for non-text contrast (3:1 minimum for UI components).

**Why it matters**: Accessibility — users may not notice the toggle is interactable.

**Note**: This appears to be a base shadcn/ui Switch component behavior, not specific to this story. Logging as LOW since it's pre-existing.

### LOW — "Add Study Block" Button Always Disabled (AC Task 1.9)

The "+ Add Study Block" button is permanently disabled with `aria-label="Add study block (coming soon)"`. While the implementation note acknowledges E50-S05 isn't built yet, this renders a non-functional button to all users.

**Recommendation**: Consider hiding the button entirely until E50-S05 ships, rather than showing it disabled. A disabled button with no explanation (tooltip or adjacent text saying "Coming in a future update") may confuse users.

## Accessibility Audit

| Check | Status |
|-------|--------|
| Switch has `aria-label="Enable calendar feed"` | PASS |
| Feed URL input has `aria-label` and `id` linked to `<label>` | PASS |
| Copy button has `aria-label` | PASS |
| AlertDialog has proper heading and description | PASS |
| Icons have `aria-hidden="true"` | PASS |
| Touch targets ≥44px | PASS (`min-h-[44px]` on all buttons) |

## Design Token Compliance

| Token | Usage | Status |
|-------|-------|--------|
| `bg-brand-soft` | Calendar icon circle | PASS |
| `text-brand` | Calendar icon color | PASS |
| `text-muted-foreground` | Description text, empty state | PASS |
| `variant="brand-outline"` | Copy and Download buttons | PASS |
| `variant="destructive"` | Regenerate button | PASS |
| `variant="brand"` | Add Study Block button | PASS |
| `text-warning` | Warning text paragraph | PASS |
| `bg-warning/10` + `border-warning/20` | Warning banner | PASS |
| `bg-surface-sunken/30` | Card header background | PASS |

**Verdict**: Design token compliance is excellent — zero hardcoded colors detected.

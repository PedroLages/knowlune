# Design Review Report — Notifications Redesign

**Review Date**: 2026-04-04
**Reviewed By**: Claude Code (design-review agent via Playwright)
**Changed Files**:
- `src/app/components/figma/NotificationCenter.tsx` (notification dropdown)
- `src/app/pages/Notifications.tsx` (full page redesign)
- `src/app/components/Layout.tsx` (sidebar cleanup)

**Affected Pages**: `/notifications`, Header dropdown (all pages)
**Test Viewport**: 1440px desktop primary, 1024px, 768px tablet, 375px mobile
**axe-core WCAG 2.1 AA scan**: 29 passes, 5 violations (2 in notifications UI, 3 in unrelated toolbar widget)

---

## Executive Summary

The notifications redesign is a significant quality upgrade. The full-page layout with timeline grouping, violet unread borders, and hover-reveal actions is visually cohesive and well-structured. The dropdown improvements (10px dots, grey for read, 12px padding) are clean and functional. Two accessibility issues require attention before merge: prohibited `aria-label` on status dot `<span>` elements, and a contrast failure on the timestamp text at `text-muted-foreground/70` opacity. The tablet layout at 768px creates a cramped reading experience due to the full-width sidebar remaining visible at that breakpoint.

---

## What Works Well

- **Timeline grouping** (TODAY / YESTERDAY / THIS WEEK / OLDER) is an excellent UX pattern — reduces cognitive scanning and respects learners' mental model of recency. The uppercase monospace labels with a horizontal rule divider are visually elegant.
- **Violet left border on unread cards** (`border-l-brand 3px`) is a strong, non-color-only visual differentiator. Combined with `bg-brand-soft/20` fill and bold title weight, the unread state is communicated through three simultaneous cues — good accessibility practice.
- **Brand "Mark all as read" button** with `variant="brand"` correctly uses the design token system. Paired with the outline settings gear, the header button group has appropriate visual hierarchy.
- **Hover-reveal action buttons** (CircleCheck + Trash2) are a clean progressive-disclosure pattern. ARIA labels include the notification title (`aria-label="Mark "Badge Earned: Fast Learner" as read"`) which is exemplary for screen reader UX.
- **Filter pills with `aria-pressed`** are correctly implemented — the `role="group"` container with a descriptive `aria-label="Notification filters"` is the right semantic pattern.
- **`aria-live="polite"` + `role="status"`** live region for state change announcements is correctly placed and implemented.
- **`aria-label` on bell button** dynamically updates to include unread count: `"Notifications (2 unread)"` — excellent.
- **Sidebar cleanup**: The `+N more features` link has been removed cleanly with no visual artifacts.
- **Background color** correctly resolves to `rgb(250, 245, 238)` / `#FAF5EE` — design token system is respected.
- **No horizontal overflow** at any breakpoint (375px, 768px, 1440px).
- **No console errors or warnings** on the `/notifications` route.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

---

### High Priority (Should fix before merge)

#### H1 — `aria-label` prohibited on `<span>` (status dots)

**File**: `src/app/pages/Notifications.tsx:81-86`
**axe rule**: `aria-prohibited-attr` (serious)
**Issue**: The read/unread status dot `<span>` elements use `aria-label="Unread"` and `aria-label="Read"`. ARIA prohibits `aria-label` on `<span>` elements that have no interactive role. The attribute will be ignored by assistive technologies, and axe flags this as a serious violation.

```tsx
// Current (violates aria-prohibited-attr)
<span
  className={cn('size-2 shrink-0 rounded-full', ...)}
  aria-label={isUnread ? 'Unread' : 'Read'}
/>
```

**Impact**: Screen readers will not announce the read/unread status via this element. The bold title weight already signals "unread" visually, but AT users have no equivalent cue.

**Suggestion**: Replace with a visually-hidden text element, or add status to the card's accessible description via `aria-describedby`. A `<span className="sr-only">` sibling is the simplest fix:

```tsx
<span className="size-2 shrink-0 rounded-full ..." aria-hidden="true" />
<span className="sr-only">{isUnread ? 'Unread' : 'Read'}</span>
```

Note: The same pattern exists in the dropdown (`NotificationCenter.tsx:150-154`) where `aria-hidden="true"` is already used — the page component should match this.

---

#### H2 — Timestamp text contrast failure (`text-muted-foreground/70`)

**File**: `src/app/pages/Notifications.tsx:99`
**axe rule**: `color-contrast` (serious)
**Issue**: The timestamp line uses `text-muted-foreground/70` (70% opacity muted foreground) with an `items-center gap-1` flex row containing a `Clock` icon. Computed color: `oklab(0.517415 ... / 0.7)`. The card background for unread items is `bg-brand-soft/20` (20% opacity), meaning the effective contrast ratio between `muted-foreground` at 70% opacity and the semi-transparent warm background is below the 4.5:1 WCAG AA threshold for 12px regular-weight text.

**Evidence**: axe flagged both unread and read card timestamp elements. The read card has `transparent` background, but the page background `#FAF5EE` means the effective ratio is still marginal.

**Impact**: Learners with low vision cannot reliably read notification timestamps, which provide important context for prioritising responses.

**Suggestion**: Raise opacity to `/80` or `/90`, or use the full `text-muted-foreground` token without opacity reduction. The `text-xs` size (12px) makes this especially sensitive — below 14px the threshold is 4.5:1, not 3:1.

```tsx
// Change from:
<p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
// To:
<p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/80">
```

---

#### H3 — Header action buttons below 44px touch target on mobile

**File**: `src/app/pages/Notifications.tsx:195-215`
**Issue**: On 375px mobile, the "Mark all as read" button renders at `152x32px` (32px height) and the settings gear renders at `36x36px`. Both are below the 44x44px minimum touch target required by WCAG 2.5.5 and the project design principles.

**Evidence**:
```
Mark all notifications as read: 152x32px  <- 32px height fails
Notification settings: 36x36px           <- both dimensions fail
```

**Impact**: On mobile, learners with motor impairments or average finger size (9mm = ~34px) will frequently mis-tap these buttons.

**Suggestion**: Add `min-h-[44px]` to the "Mark all" button and use `size-11` (44px) instead of `size-9` for the settings icon button on mobile, or wrap both in a container with adequate spacing.

---

### Medium Priority (Fix when possible)

#### M1 — Duplicate `aria-label` on `<section>` and its inner `role="list"`

**File**: `src/app/pages/Notifications.tsx:271-283`
**Issue**: Each timeline section has `aria-label="TODAY notifications"` AND the `role="list"` div inside also has `aria-label="TODAY notifications"`. Screen readers will announce the label twice when entering the region.

**Evidence** (computed from accessibility tree):
```
Section aria-label: "TODAY notifications"
Inner role="list" aria-label: "TODAY notifications"  <- duplicate
```

**Suggestion**: Remove `aria-label` from the inner `role="list"` — the section landmark already provides the group context. The list items themselves are navigable via the listitem role.

```tsx
// Remove aria-label from the inner list:
<div className="space-y-3" role="list">
```

---

#### M2 — Tablet 768px: sidebar remains full-width, cramping content

**Issue**: At 768px the sidebar renders at 231px wide, leaving only ~489px for the notification content. The `max-w-3xl` (768px) container can never reach its maximum width at this viewport, and cards appear truncated in the viewport.

**Evidence**: Sidebar width 231px at 768px viewport. Content rect `{ width: 720, left: 24 }` — but the sidebar occupies the left 231px, so visible card content width ≈ 720 - 231 = 489px. Screenshot `/tmp/30-tablet-768.png` shows content is tight.

**Impact**: This is the existing sidebar behaviour (not introduced by this PR), but the `max-w-3xl` centred layout amplifies the squeeze at this breakpoint because the container tries to centre within the remaining space.

**Suggestion**: This is a pre-existing layout behaviour. The notifications page doesn't need to fix the sidebar collapse threshold, but if the sidebar team targets this breakpoint in a future epic, the notifications layout will benefit automatically.

---

#### M3 — Redundant ARIA on `<section>` for keyboard shortcuts section

**Issue**: The accessibility tree shows a third section with `aria-label="Notifications alt+T"` — this appears to be the keyboard shortcuts dialog's section leaking into the tree (not a notifications page bug per se, but worth noting as it creates confusing AT output on this route).

**Evidence**: `sections: ["TODAY notifications", "YESTERDAY notifications", "Notifications alt+T"]`

**Suggestion**: Investigate where `"Notifications alt+T"` comes from — likely the `KeyboardShortcutsDialog` component rendered in `Layout.tsx` which may need `aria-hidden="true"` on its trigger when not active.

---

### Nitpicks (Optional)

#### N1 — Timeline group labels use uppercase monospace (`font-mono`)

The `font-mono` class on `"TODAY"`, `"YESTERDAY"` labels is a nice touch but may feel slightly disconnected from the sans-serif system font used elsewhere. Consider whether `font-display` with `tracking-widest` achieves the same visual effect while staying within the type system. This is a preference call — both look good.

#### N2 — Unread pill count embedded in button text

`"Unread 2"` as button text means a screen reader announces "Unread 2, toggle button". This is acceptable but slightly awkward. A visually-hidden count with `aria-label="Unread notifications, 2 unread"` would be cleaner for AT users. Low priority.

#### N3 — Dropdown `size-2.5` dots vs page `size-2` dots

The dropdown uses `size-2.5` (10px) status dots, the full page uses `size-2` (8px). Both are consistent within their respective components, but the slight size discrepancy is technically an inconsistency between the two views. 8px on the full page is fine given the larger card context.

---

## Detailed Evidence

### Bell Dropdown (10px dots, 12px padding)
- Unread dot: `10px x 10px`, `rgb(94, 106, 210)` (brand blue) — confirmed
- Read dot: `10px x 10px`, semi-transparent grey (`oklab... / 0.3)`) — confirmed
- Item padding: `12px block, 12px inline` — confirmed larger than default
- Screenshot: `/tmp/06-bell-dropdown-crop.png`

### Notifications Page Layout
- Background: `rgb(250, 245, 238)` / `#FAF5EE` — correct
- Max-width: `768px`, auto margins — centered on 1440px as intended
- Unread card border-left: `3px solid rgb(94, 106, 210)` — confirmed
- Unread card background: `oklab(0.870948... / 0.2)` (brand-soft/20) — confirmed
- Read card background: `transparent` with `1px border` — confirmed
- Screenshot: `/tmp/20-notif-page-clean-1440.png`

### Hover-Reveal Actions
- Buttons present: Mark as read (`size-8`, 32x32px) + Dismiss (`size-8`, 32x32px)
- ARIA labels include notification title — exemplary
- Screenshot: `/tmp/21-notif-hover.png`

### Dark Mode
- Cards render correctly in dark mode — colours adapt via CSS variable system
- Screenshot: `/tmp/24-dark-mode.png`

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Fail | Timestamp `text-muted-foreground/70` at 12px fails — see H2 |
| Text contrast ≥3:1 (large text / 18px+) | Pass | Headings and body text pass |
| Keyboard navigation — logical tab order | Pass | Skip link → sidebar nav → header → page content |
| Focus indicators visible | Pass | Radix UI focus ring present on all interactive elements |
| Heading hierarchy | Pass | Single `H1` "Notifications", no sub-headings needed for this layout |
| ARIA labels on icon buttons | Pass | Settings gear, action buttons all have descriptive labels |
| `aria-label` on status dot `<span>` | Fail | Prohibited on non-interactive span — see H1 |
| `aria-pressed` on filter pills | Pass | Both "All" and "Unread" correctly toggled |
| `aria-live` region for state changes | Pass | `role="status" aria-live="polite"` present |
| `aria-current="page"` on sidebar nav | Pass | Active nav links carry `aria-current="page"` |
| Semantic HTML (section, nav, h1) | Pass | Sections with labels, proper heading |
| Touch targets ≥44px (mobile) | Partial Fail | Filter pills and bell pass; header action buttons fail — see H3 |
| `prefers-reduced-motion` | Not tested | Transition classes used; no explicit motion guard in notification cards |
| Dark mode contrast | Pass | Dark mode renders correctly, no obvious contrast regressions |
| No console errors | Pass | Zero errors or warnings on route |
| No horizontal overflow | Pass | All breakpoints confirmed clean |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Desktop 1440px | Pass | Centred `max-w-3xl` layout, correct spacing, all elements visible |
| Sidebar collapse 1024px | Pass | Sidebar still visible, content readable, no overflow |
| Tablet 768px | Partial | No overflow, but sidebar (231px) + content creates tight reading width. Pre-existing layout issue amplified by centred container. |
| Mobile 375px | Pass | Single column, header stacks (flex-column), filter pills full-width, no overflow. Bottom navigation present. |

---

## Recommendations

1. **Fix H1 now** — Remove `aria-label` from status dot `<span>` elements in `Notifications.tsx`. Add a `<span className="sr-only">` sibling instead. Match the pattern already used correctly in `NotificationCenter.tsx` (which uses `aria-hidden="true"` on the dot).

2. **Fix H2 now** — Raise timestamp opacity from `/70` to `/80` minimum. This is a single-character change and resolves the WCAG AA contrast failure on a key piece of contextual information.

3. **Fix H3 before mobile testing** — The "Mark all as read" and settings gear buttons need `min-h-[44px]` on mobile. Given this page is likely accessed from mobile notifications, this is a real usability gap.

4. **Address M1 in this PR** — Removing the redundant `aria-label` from the inner `role="list"` is a one-line change that cleanly eliminates duplicate AT announcements.


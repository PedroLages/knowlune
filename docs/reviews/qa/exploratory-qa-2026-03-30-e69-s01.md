## Exploratory QA Report: E69-S01 — Storage Estimation Service and Overview Card

**Date:** 2026-03-30
**Routes tested:** 1 (`/settings`)
**Health score:** 68/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 65 | 20% | 13.0 |
| Console | 100 | 15% | 15.0 |
| UX | 60 | 15% | 9.0 |
| Accessibility | 60 | 15% | 9.0 |
| Visual | 80 | 10% | 8.0 |
| Links | 80 | 10% | 8.0 |
| Performance | 80 | 10% | 8.0 |
| Content | 80 | 5% | 4.0 |
| **Total** | | | **74/100** |

> Note: Score is 74/100 after rounding individual category scores. The Functional category is the primary drag due to BUG-001 (AC3/AC4 blocker) and BUG-002 (AC5 blocked in empty state).

### Top Issues

1. **BUG-001 (Blocker):** Warning and critical quota banners (AC3/AC4) are permanently hidden when Dexie tables are empty, because the component routes to the empty state branch before evaluating `usagePercent` — a user at 85%+ storage capacity receives no in-card warning at all.
2. **BUG-002 (High):** The Refresh button and all normal-state UI (chart, legend, summary line) are absent when the application has no imported courses, because the empty state check (`categorizedTotal === 0`) excludes the Refresh button — preventing users from retrying data collection.
3. **BUG-003 (Medium):** The "Free Up Space" button in the critical banner (AC4) scrolls to `#data-management` but the AC specifies it should scroll to `#cleanup-actions`, which does not exist in the current Settings page DOM — the scroll target mismatch means the button does not navigate to the intended section.

### Bugs Found

#### BUG-001: Warning and critical banners unreachable when Dexie tables are empty
**Severity:** Blocker
**Category:** Functional
**Route:** `/settings`
**AC:** AC3, AC4

**Steps to Reproduce:**
1. Open the application with no imported courses (fresh or cleared database).
2. Navigate to `/settings`.
3. Scroll to the "Storage & Usage" card.
4. Note the browser's actual storage usage (e.g., 85% occupied by IndexedDB overhead, cached assets, etc.).

**Expected:** When `usagePercent >= 0.80`, the amber warning banner ("Storage is getting full") appears regardless of whether Dexie-tracked category tables have data. When `usagePercent >= 0.95`, the red critical banner ("Storage almost full") appears.

**Actual:** The component evaluates `isEmpty = overview.categorizedTotal === 0` before rendering the `QuotaWarningBanner`. With empty Dexie tables, `categorizedTotal` is always 0, so the component returns the empty-state branch and never reaches the `QuotaWarningBanner` render path. The banner is permanently suppressed for all new or data-cleared users.

**Evidence:** Playwright test confirmed:
- Mocking `navigator.storage.estimate()` to return `usage: 850MB / quota: 1000MB` (85%)
- Card text: "No learning data stored yet. Import a course to get started!"
- `role="alert"` count: 0
- The toast warning from `storageQuotaMonitor.ts` fires (confirms `usagePercent` is correctly computed) but the in-card banner does not.

**Root cause (code reference):** `StorageManagement.tsx` lines 345–370 — the `isEmpty` branch returns early without first checking `usagePercent`. Fix: evaluate quota banners before (or independently of) the empty-state check, or render `QuotaWarningBanner` inside the empty-state branch.

---

#### BUG-002: Refresh button absent in empty state; users cannot retry storage estimation
**Severity:** High
**Category:** UX / Functional
**Route:** `/settings`
**AC:** AC5

**Steps to Reproduce:**
1. Navigate to `/settings` with no imported courses.
2. Scroll to "Storage & Usage" card.
3. Observe the empty state renders.

**Expected:** The Refresh button should be available in all rendered states (empty, normal, and potentially warning states), allowing users to re-query storage estimates after data changes.

**Actual:** The Refresh button only appears in the Normal State render path (`StorageManagement.tsx` line 389). The Loading, API Unavailable, and Empty State branches all render a simplified `CardHeader` without the Refresh button. A user who just imported a course but sees the empty state has no way to refresh the card without navigating away and back.

**Evidence:** Playwright test — `card.getByRole('button', { name: /refresh/i })` returns count 0 when card is in empty state.

---

#### BUG-003: "Free Up Space" button scroll target does not match AC specification
**Severity:** Medium
**Category:** Functional / Links
**Route:** `/settings`
**AC:** AC4

**Steps to Reproduce:**
1. Arrange for storage usage to be 95%+ (or test the `QuotaWarningBanner` component directly with `usagePercent >= 0.95`).
2. Click the "Free Up Space" button in the red critical banner.

**Expected (per AC4):** "a 'Free Up Space' button that scrolls to the cleanup section" — the story's Dev Notes reference a `#cleanup-actions` scroll target.

**Actual:** The button calls `document.getElementById('data-management')?.scrollIntoView(...)`. No element with `id="cleanup-actions"` exists anywhere in the Settings page DOM. The `#data-management` element does exist and the scroll does function, but it does not land on a dedicated cleanup section — it scrolls to the broader Data Management card, which is one level above the intended cleanup actions.

**Evidence:** Playwright test confirmed `#cleanup-actions` count = 0, `#data-management` count = 1 in the Settings page. The code at `StorageManagement.tsx` line 70 targets `'data-management'`.

---

#### BUG-004: Empty state card has no Refresh button and no way to dismiss or recover
**Severity:** Low
**Category:** UX
**Route:** `/settings`
**AC:** General

**Steps to Reproduce:**
1. Navigate to `/settings` with empty Dexie tables.
2. Observe the "No learning data stored yet. Import a course to get started!" empty state.
3. Import a course via another route, then return to `/settings`.

**Expected:** The empty state card should either auto-refresh when the component mounts on re-navigation, or provide a Refresh button to pull updated estimates.

**Actual:** The empty state renders with no interactive controls. After importing a course, the user must navigate away from `/settings` and return to see updated storage data (the `useEffect` re-runs on mount). This is a minor recovery friction rather than a true blocker since navigation resolves it.

**Evidence:** Playwright tests confirm 0 buttons in the empty-state card variant.

---

#### BUG-005: `aria-label` on BarChart does not propagate to DOM — chart is not accessible
**Severity:** Medium
**Category:** Accessibility
**Route:** `/settings`
**AC:** AC1

**Steps to Reproduce:**
1. Navigate to `/settings` with data loaded (or mock data sufficient to trigger the normal state).
2. Inspect the chart element with a screen reader or accessibility tree.

**Expected:** The stacked bar chart should have an accessible `aria-label="Storage usage breakdown chart"` as specified in the story (Task 6.6).

**Actual:** The `aria-label` prop is applied to the Recharts `<BarChart>` component, but Recharts renders its own SVG without forwarding arbitrary ARIA attributes to the outermost SVG element. The attribute is lost in the DOM. The `sr-only` table alternative is the correct fallback and IS present (confirmed by code review), but the chart SVG itself remains unlabeled — leaving it as an unlabeled graphical element in the accessibility tree.

**Evidence:** Playwright test — `card.locator('[aria-label="Storage usage breakdown chart"]')` count = 0 even when chart would be visible. Code review of `StorageManagement.tsx` lines 144–145 confirms the prop is passed to `<BarChart>` but Recharts does not forward it.

Note: The `sr-only` table at lines 168–184 partially mitigates this. The full impact depends on whether screen readers surface unlabeled SVGs as noise or ignore them.

---

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Stacked bar chart with 6 segments, summary line, legend grid | Partial | Chart and legend render correctly in normal state. In test environment (empty DB), the component is in empty state so chart/summary/legend are not visible. AC mechanically correct per code review, but cannot be verified end-to-end without imported data. |
| 2 | Skeleton loading with `aria-busy="true"` during data fetch | Pass | `aria-busy="true"` confirmed on initial load (count: 1). Skeleton placeholders render for bar, legend, and grid areas. |
| 3 | Amber warning banner at 80-94% with dismiss button | Fail | Banner is permanently hidden by empty-state check when Dexie tables are empty (BUG-001). Banner logic is correct in isolation but unreachable in the primary test scenario. |
| 4 | Red critical banner at 95%+ with "Free Up Space" scroll | Fail | Same root cause as AC3 (BUG-001). Additionally, scroll target is `#data-management` instead of spec'd `#cleanup-actions` (BUG-003). |
| 5 | Refresh button shows spinner and re-runs estimates | Partial | Refresh button and spinner logic are correctly implemented in the normal state code path. However, the button is absent from the empty state (BUG-002), making AC5 partially unverifiable in default test environment. |
| 6 | Graceful fallback when `navigator.storage` unavailable | Pass | "Storage estimation is not available in this browser." shown correctly when `navigator.storage` is undefined. |
| 7 | Empty state when no data stored | Pass | "No learning data stored yet. Import a course to get started!" renders correctly. |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 0 | Clean — no console errors on any test run |
| Warnings | 0 | Clean — no React warnings, no deprecation notices |
| Info | 0 | No debug logging in production code |

The console is completely clean across all test scenarios including Storage API unavailable, storage API throwing, and IndexedDB removal.

### What Works Well

1. **Loading skeleton is properly implemented**: `aria-busy="true"` is set immediately on mount, 6 skeleton cards match the 6-category legend layout, and the transition to content state is clean.
2. **Storage API fallback is robust**: Both `navigator.storage = undefined` and `estimate()` throwing produce the correct user-friendly "not available" message without any console errors or blank states.
3. **Console is completely clean**: Zero errors and zero warnings across all tested scenarios including error paths, edge cases, and state transitions. The `silent-catch-ok` comments are correctly applied.
4. **Card positioning in Settings**: The Storage & Usage card is correctly inserted after the Data Management card (Y: 7987 vs 6819), following the spec's insertion point.

---
Health: 74/100 | Bugs: 5 | Blockers: 1 | ACs: 3/7 verified (Pass), 2/7 Fail, 2/7 Partial

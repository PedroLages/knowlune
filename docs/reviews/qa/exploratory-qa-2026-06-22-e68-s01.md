## Exploratory QA Report: E68-S01 — Model Download Progress UI (Round 2)

**Date:** 2026-06-22
**Routes tested:** 0 (global toast, no route affected)
**Health score:** 87/100

### Health Score Breakdown

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Functional | 80 | 30% | 24.0 |
| Edge Cases | 95 | 15% | 14.25 |
| Console | 85 | 15% | 12.75 |
| UX | 75 | 15% | 11.25 |
| Links | 100 | 10% | 10.0 |
| Performance | 95 | 10% | 9.5 |
| Content | 100 | 5% | 5.0 |
| **Total** | | | **87/100** |

### Top Issues

1. WelcomeWizard dialog overlay blocks the embedding model progress toast's "Skip" action button — first-time users cannot dismiss the progress toast while the wizard is open (HIGH)
2. Pre-existing syncEngine console errors remain on app load (MEDIUM)

### Bugs Found

#### BUG-001: WelcomeWizard dialog overlay prevents clicking Skip on progress toast

**Severity:** High
**Category:** Functional / UX
**Route:** / (landing page, first visit)
**AC:** AC2

**Steps to Reproduce:**
1. Open the app in a fresh browser (no previous session)
2. WelcomeWizard dialog appears
3. Model download begins (warm-up after 3s idle triggers the download)
4. Progress toast appears with "Skip" action button
5. Attempt to click the "Skip" button on the toast

**Expected:** The toast's "Skip" button should be clickable. Clicking it dismisses the toast and the download continues in the background.

**Actual:** The Radix UI Dialog overlay (z-50, full-viewport, `data-slot="dialog-overlay"`) intercepts all pointer events. Playwright confirms: "element is visible, enabled and stable" but "div ... z-50 bg-black/50 intercepts pointer events". The click fails with a timeout error. The Sonner toast is rendered above the overlay in visual stacking order, but the Dialog's pointer-dismiss behavior captures the click.

**Evidence:** Playwright test confirmation:
```
TimeoutError: locator.click: Timeout 15000ms exceeded.
- <div data-state="open" data-slot="dialog-overlay" class="... z-50 bg-black/50"></div> intercepts pointer events
```

The bug was reproduced consistently across 3 test runs on Chromium. The Skip button click only succeeds when `{ force: true }` is used (bypassing actionability checks), confirming the overlay is the sole blocker.

**Note:** Round 1 bugs BUG-001 (close button label) and BUG-004 (description text) are confirmed fixed. The toast now correctly shows a "Skip" action button with fallback text.

#### BUG-002: Pre-existing syncEngine console errors

**Severity:** Medium
**Category:** Console
**Route:** All routes
**AC:** General

**Steps to Reproduce:**
1. Open the app
2. Check browser console

**Expected:** No console errors.

**Actual:** Two syncEngine download errors appear on every page load:
- `[syncEngine] Download error for table "ai_usage_events": column ai_usage_events.updated_at does not exist`
- `[syncEngine] Download error for table "quiz_attempts": column quiz_attempts.updated_at does not exist`

**Evidence:** Console capture from Playwright test confirmed both errors present. These are pre-existing and unrelated to E68-S01.

### Round 1 Bug Verification

| Bug ID | Description | Status | Notes |
|--------|-------------|--------|-------|
| BUG-001 | Close button lacks "Skip" label | **FIXED** | Now shows action button with label "Skip" and fallback text |
| BUG-002 | Error feedback delayed by 15s | **OPEN** | First-progress timeout (15s) still exists; mitigated by worker-crash handler |
| BUG-003 | Tab visibility terminates worker | **ACKNOWLEDGED** | Documented as deferred to E68-S03 |
| BUG-004 | Description text differs from AC | **FIXED** | Now correctly says "Downloading AI model... {progress}%" |

### AC Verification

| AC# | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Sonner toast appears with progress bar showing percentage, updates at least every 500ms | Pass | Toast appears with progress bar. Debounced at 500ms. Description includes fallback info text. |
| 2 | Skip button dismisses toast, download continues, system falls back to keyword search | Partial | Skip button exists and is correctly labeled. But it is unclickable when WelcomeWizard dialog overlay is present (first-time users). Dismisses correctly when no overlay blocks it. |
| 3 | Success toast replaces progress toast on completion | Pass | "AI search ready!" toast appears, progress toast dismissed cleanly. |
| 4 | Indeterminate loading state when total=0 (not "NaN%" or "0%") | Pass | Shows loading spinner toast with "Downloading AI model..." text when progress < 0. |
| 5 | CustomEvent('model-download-progress') dispatched on window | Pass | Events flow from worker -> coordinator -> CustomEvent -> hook -> toast. Verified via unit tests and live CustomEvent dispatch. |

### Console Health

| Level | Count | Notable |
|-------|-------|---------|
| Errors | 2 | Both pre-existing sync schema issues: `ai_usage_events.updated_at`, `quiz_attempts.updated_at`. 0 story-related errors. |
| Warnings | 0 | None observed during testing |
| Info | 0 | No extraneous debug logging in production paths |

### What Works Well

1. **Round 1 bug fixes are solid**: The Skip button is now correctly labeled, the description matches the AC spec with fallback text, and the worker-crash handler surfaces failures immediately instead of waiting for the 15s timeout.

2. **Robust progress debouncing**: Rapid progress updates from Transformers.js per-file callbacks are debounced to 500ms. Verified via unit tests and live dispatch — no visual thrashing.

3. **Graceful completion flow**: Success toast ("AI search ready!") replaces the progress toast cleanly without stacking. The progress toast is dismissed first, then the success toast appears with a 4s auto-dismiss.

4. **All 36 unit tests pass** across 3 test files (coordinator, App warmup, progress toast) — covering all ACs, edge cases (indeterminate state, debounce, fallback timer, worker crash), and the original 4 bug scenarios.

---
Health: 87/100 | Bugs: 2 (1 HIGH, 1 MEDIUM) | Blockers: 0 | ACs: 4/5 verified

# QA Report: Knowlune

**Date:** 2026-03-25
**URL:** http://localhost:5173
**Branch:** main
**Mode:** Full exploration
**Framework:** React 19 SPA (Vite + React Router)
**Duration:** ~10 minutes
**Pages visited:** 8

---

## Health Score: 72/100

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Console | 40 | 15% | 6.0 |
| Links | 100 | 10% | 10.0 |
| Visual | 85 | 10% | 8.5 |
| Functional | 70 | 20% | 14.0 |
| UX | 75 | 15% | 11.25 |
| Performance | 85 | 10% | 8.5 |
| Content | 90 | 5% | 4.5 |
| Accessibility | 80 | 15% | 12.0 |
| **Total** | | | **74.75** |

---

## Top 3 Things to Fix

1. **Multiple pages render blank content** — Courses, Career Paths, Flashcards, Reports, Settings all show only sidebar + header with empty content area. No empty state, no loading indicator, no CTA.
2. **Mobile viewport shows blank Overview** — At 375px width, the entire Overview content area (courses, streaks, stats) disappears. Only header bar and bottom nav visible.
3. **Recharts dimension warnings** — 5 console warnings about chart containers with -1 width/height. Charts render in collapsed containers.

---

## Issues

### ISSUE-001: Pages render with blank content area
**Severity:** High
**Category:** Functional
**Pages affected:** /courses, /career-paths, /flashcards, /reports (Reports not in sidebar), /settings
**Description:** Navigating to these routes renders the Layout (sidebar + header) but the main content area is completely blank. No empty state message, no loading spinner, no "import courses to get started" CTA. A new user would think the app is broken.
**Evidence:** Screenshots at /tmp/qa-knowlune-courses.png, /tmp/qa-knowlune-career-paths.png, /tmp/qa-knowlune-flashcards.png, /tmp/qa-knowlune-settings.png
**Repro:**
1. Navigate to http://localhost:5173/courses
2. Observe blank content area below the header

**Note:** /my-class works correctly and shows courses with filters and stats. /overview works correctly with the learning studio view.

---

### ISSUE-002: Mobile viewport — Overview content disappears
**Severity:** High
**Category:** Visual / Responsive
**Page affected:** / (Overview)
**Description:** At mobile viewport (375x812), the Overview page shows only the header bar (search, theme toggle, notifications, avatar) and bottom navigation (Overview, My Courses, Courses, More). The entire main content area — learning studio, course recommendations, streaks — is gone.
**Evidence:** Screenshot at /tmp/qa-knowlune-mobile-overview.png
**Repro:**
1. Navigate to http://localhost:5173/
2. Dismiss the welcome wizard
3. Resize viewport to 375x812 (or view on mobile device)
4. Observe: header and bottom nav visible, content area blank

---

### ISSUE-003: Recharts dimension warnings (5 occurrences)
**Severity:** Medium
**Category:** Console
**Page affected:** All pages (warnings persist across navigation)
**Description:** Recharts logs repeated warnings: "The width(-1) and height(-1) of chart should be greater than 0". This happens when chart components mount in collapsed or hidden containers (likely the Overview dashboard widgets). The charts may not render correctly when their container becomes visible.
**Evidence:** Console output from browse tool
**Repro:**
1. Navigate to http://localhost:5173/
2. Open browser console
3. Observe 5 Recharts dimension warnings

---

### ISSUE-004: Welcome wizard re-appears after dismissal
**Severity:** Low
**Category:** UX
**Page affected:** / (Overview)
**Description:** The welcome wizard/onboarding modal appears to re-render after being dismissed with "Skip for now." Clicking "Skip for now" closes the modal, but it reappears briefly when the page re-renders. The "Skip onboarding" button (@e88) eventually works to fully dismiss it.
**Evidence:** Screenshots at /tmp/qa-knowlune-overview.png (wizard still showing after skip)
**Repro:**
1. Navigate to http://localhost:5173/
2. Click "Skip for now" on the welcome wizard
3. Wizard closes briefly then the page shows a second onboarding prompt

---

### ISSUE-005: Agentation overlay visible in QA/accessibility tree
**Severity:** Low
**Category:** Visual
**Page affected:** All pages
**Description:** The Agentation toolbar (@e12 in the accessibility tree — a large button with "v2.3.1 Output Detail Standard React Components...") appears in the DOM on all pages. This is a development/debugging tool that should be hidden or removed before production deployment. It shows up in accessibility snapshots as a massive interactive element.
**Evidence:** Visible in every snapshot -i output
**Note:** This is likely a dev-only tool and would not appear in production. Flagging for awareness.

---

## Console Health Summary

| Level | Count | Details |
|-------|-------|---------|
| Errors | 1 | React Router ErrorBoundary on /my-courses (manually typed URL — not user-facing) |
| Warnings | 5 | Recharts dimension warnings (-1 width/height) |
| Total | 6 | |

---

## What Works Well

- **Overview page (desktop):** Clean layout, course recommendations, "Start Your Learning Journey" CTA
- **My Class page:** Shows courses with thumbnails, category filters, difficulty badges, progress stats
- **Dark mode toggle:** Clean transition, all pages render correctly in both themes
- **Search command palette (Cmd+K):** Opens quickly, shows pages and navigation targets
- **Sidebar navigation:** All links work correctly, active state highlights properly
- **Course detail / lesson player:** Video player found with controls (play, progress, speed, mark complete)
- **Bottom nav on mobile:** Correctly replaces sidebar on narrow viewports

---

## Pages Visited

| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Overview | / | Works (desktop) | Blank on mobile |
| My Class | /my-class | Works | Courses, filters, stats |
| Courses | /courses | Blank | No content renders |
| Career Paths | /career-paths | Blank | No content renders |
| Flashcards | /flashcards | Blank | No content renders |
| Settings | /settings | Blank | No content renders |
| Reports | /reports | Blank | No content renders, not in sidebar |
| Lesson Player | /courses/6mx/6mx-welcome-intro | Works | Video player functional |

---

## No test framework issues detected

Vitest is configured in vite.config.ts with unit and server test projects. Playwright is available for E2E.

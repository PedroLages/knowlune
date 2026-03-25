# Adversarial Review: Epic 27 — Analytics Consolidation

**Date:** 2026-03-25
**Reviewer:** Claude (Adversarial)
**Epic:** E27 — Analytics Consolidation (3 stories: E27-S01, E27-S02, E27-S03)
**Verdict:** Low-risk epic, competently executed, but several gaps warrant attention.

---

## Findings Summary

| # | Severity | Category | Finding |
|---|----------|----------|---------|
| 1 | HIGH | AC Violation | Back button AC contradicts `replace: true` implementation |
| 2 | MEDIUM | Bug | Duplicate `data-testid="quiz-completion-rate-card"` across components |
| 3 | MEDIUM | Testing Gap | Zero mobile/tablet E2E coverage for Reports tabs |
| 4 | MEDIUM | Architecture | `setSearchParams({ tab: value })` strips all other query params |
| 5 | MEDIUM | Testing Gap | Unit tests for Reports.tsx have no URL-aware tab assertions |
| 6 | MEDIUM | UX Debt | Quiz Completion Rate card orphaned on Study tab after consolidation |
| 7 | LOW | Mobile UX | Three `/reports` items in overflow drawer — visual clutter |
| 8 | LOW | Architecture | `getOverflowNav` filters by `path` not `path+tab`, causing false overlap |
| 9 | LOW | Testing Gap | No E2E test for SearchCommandPalette navigation to Quiz/AI Analytics destinations |
| 10 | LOW | Process | No retrospective conducted for Epic 27 |
| 11 | LOW | Scope | Legacy redirects solve a problem that never existed |
| 12 | INFO | Code Quality | `VALID_TABS` duplicated across navigation.ts and Reports.tsx |

---

## Detailed Findings

### 1. [HIGH] AC Violation: Back Button Behavior Contradicts Implementation

**Location:** `src/app/pages/Reports.tsx:215`, `docs/implementation-artifacts/27-1-add-analytics-tabs-to-reports-page.md:44`

**The AC states:**
> "the browser back button returns to the previous tab"

**The implementation uses:**
```typescript
onValueChange={value => setSearchParams({ tab: value }, { replace: true })}
```

`replace: true` explicitly replaces the current history entry, meaning the back button will NOT return to the previous tab — it will leave the Reports page entirely. The E2E test (lines 124–139 of story-e27-s01.spec.ts) tests that tab clicks update URLs but never asserts back-button behavior. The test comment even acknowledges this as a "deliberate UX choice," but the AC was never updated to reflect the deviation.

**Impact:** The acceptance criteria and implementation disagree. Either the AC is wrong (should say "back button returns to previous page, not previous tab") or the implementation is wrong (should use `push` semantics).

**Recommendation:** Update AC5 in the story file to match the implemented `replace` behavior. Document the rationale (prevents history pollution).

---

### 2. [MEDIUM] Duplicate `data-testid="quiz-completion-rate-card"`

**Location:**
- `src/app/pages/Reports.tsx:429` — Study tab's "Quiz Completion Rate" card
- `src/app/components/reports/QuizAnalyticsTab.tsx:209` — Quiz tab's "Attempts per Quiz" card

Both use `data-testid="quiz-completion-rate-card"`. While they appear on different tab panels (only one visible at a time), this violates the principle that test IDs should be unique per page. Any future test using `getByTestId('quiz-completion-rate-card')` will match unpredictably depending on tab state or if both TabsContent panels are in the DOM but hidden.

**Recommendation:** Rename the QuizAnalyticsTab card to `data-testid="quiz-attempts-per-quiz-card"` since it shows "Attempts per Quiz", not completion rate.

---

### 3. [MEDIUM] Zero Mobile/Tablet E2E Coverage for Reports Tabs

**Location:** All three E27 spec files use default or desktop viewports only.

None of the E27 E2E tests verify:
- Tab switching works on mobile viewports (640px)
- Tab labels remain readable when 3 tabs are rendered on small screens
- The TabsList doesn't overflow or truncate on narrow viewports
- BottomNav "More" drawer correctly shows 3 analytics items and navigates to tabs

The project's design principles require mobile-first approach with responsive breakpoints at 640px, 1024px, and 1536px.

**Recommendation:** Add at least one mobile-viewport test per story spec to verify tab rendering at 375px width.

---

### 4. [MEDIUM] `setSearchParams` Strips Other Query Parameters

**Location:** `src/app/pages/Reports.tsx:215`

```typescript
setSearchParams({ tab: value }, { replace: true })
```

This replaces ALL search params with just `{ tab: value }`. If any future feature adds additional query params to the Reports page (e.g., `?tab=study&period=weekly` or `?tab=study&course=abc`), clicking a tab will silently destroy them. The correct pattern preserves existing params:

```typescript
setSearchParams(prev => {
  prev.set('tab', value)
  return prev
}, { replace: true })
```

**Impact:** No current bug (Reports only uses `?tab=`), but this is a latent defect that will cause a regression when the page gets more query params.

---

### 5. [MEDIUM] Unit Tests Have No URL-Aware Tab Assertions

**Location:** `src/app/pages/__tests__/Reports.test.tsx`

The unit test file wraps renders in `<MemoryRouter>` (correct for `useSearchParams`), but all 3 test cases render at the default route (`/reports`) and only check that the heading, stat labels, and chart headings exist. There are zero assertions for:
- `?tab=quizzes` rendering the QuizAnalyticsTab mock
- `?tab=ai` rendering the AIAnalyticsTab mock
- `?tab=invalid` falling back to Study tab
- Tab trigger visibility (3 tabs present)

The E27-S02 plan explicitly described adding 4 URL-aware unit tests, but only the `MemoryRouter` wrapper was added — the actual tab-switching unit tests were never written.

**Recommendation:** Add the 4 unit tests from the E27-S02 plan (Task 3, Step 3).

---

### 6. [MEDIUM] Quiz Completion Rate Card Orphaned on Study Tab

**Location:** `src/app/pages/Reports.tsx:427-471`

E27-S01 moved the retake frequency card to the Quiz Analytics tab but left the "Quiz Completion Rate" card (with progress bar) on the Study tab. This creates a split-brain analytics experience:
- **Study tab:** Shows "Quiz Completion Rate" (progress bar + percentage)
- **Quiz tab:** Shows "Attempts per Quiz", "Average Score", retake frequency

A user looking for quiz analytics would expect ALL quiz metrics on the Quiz tab. The Quiz Completion Rate card on the Study tab is conceptually quiz analytics, not study analytics.

**Recommendation:** Move the Quiz Completion Rate card to QuizAnalyticsTab in a follow-up story, or document this as intentional cross-referencing.

---

### 7. [LOW] Three `/reports` Items in Mobile Overflow Drawer

**Location:** `src/app/components/navigation/BottomNav.tsx:83-84`

The BottomNav "More" drawer renders all overflow items grouped by `navigationGroups`. Since all three analytics items (`Study Analytics`, `Quiz Analytics`, `AI Analytics`) share path `/reports` and are in the "Track" group, users see three visually similar items with nearly identical names in the drawer. On mobile, this is visual clutter compared to the original single "Reports" entry.

**Impact:** Minor UX friction. Not a bug, but the information density is higher than needed for mobile's constrained screen real estate.

---

### 8. [LOW] `getOverflowNav` Filters by Path Only, Not Path+Tab

**Location:** `src/app/config/navigation.ts:100-106`

```typescript
export function getPrimaryNav(): NavigationItem[] {
  return navigationItems.filter(item => primaryNavPaths.includes(item.path))
}
export function getOverflowNav(): NavigationItem[] {
  return navigationItems.filter(item => !primaryNavPaths.includes(item.path))
}
```

`primaryNavPaths` is `['/', '/my-class', '/courses', '/notes']`. The filter uses `item.path`, not a composite key. This currently works because no primary nav items have `tab` properties. But if a future item like `{ path: '/courses', tab: 'favorites' }` were added, it would incorrectly match `primaryNavPaths` and appear in the bottom bar.

**Impact:** No current bug. Latent fragility.

---

### 9. [LOW] No E2E Test for Command Palette Navigation to Quiz/AI Tab

**Location:** `tests/e2e/regression/story-e27-s03.spec.ts:118-136`

The existing E2E test opens the command palette, searches "Analytics", and verifies all three options appear. It then clicks "Study Analytics" and verifies navigation. However, it never tests that clicking "Quiz Analytics" or "AI Analytics" navigates to the correct URL. The test trusts that if Study works, the others will too — but they have different `path` values (`/reports?tab=quizzes` vs `/reports?tab=study`).

**Recommendation:** Add two more click-and-verify assertions for Quiz and AI Analytics command palette entries.

---

### 10. [LOW] No Retrospective for Epic 27

**Location:** `docs/implementation-artifacts/sprint-status.yaml:392`

The sprint status shows `epic-27-retrospective: optional` and no retrospective file exists. Per the story workflow, after epic completion the team should run `/retrospective` for lessons learned. Epic 27 is marked `done` but the retrospective was skipped.

For a 3-story cosmetic epic this is acceptable, but it breaks the pattern established by earlier epics. Any lessons from E27 (e.g., the AC5 back-button contradiction) won't be captured.

---

### 11. [LOW] Legacy Redirects Solve a Problem That Never Existed

**Location:** `src/app/routes.tsx:247-259`

E27-S02 added three `<Navigate>` redirects for `/reports/study`, `/reports/quizzes`, `/reports/ai`. The E27-S02 plan itself acknowledges: "Even though no code currently links to these paths." These paths never existed in any version of the app — there are no bookmarks, no external links, no documentation pointing to them.

This is defensive engineering that adds 3 route entries for a problem that has zero evidence of occurring. The cost is minimal (3 lines), but the story itself is arguably unnecessary scope — a YAGNI violation.

**Counter-argument:** The cost is truly trivial. But it inflates the epic's story count and creates a precedent of pre-emptive redirects for URLs that never existed.

---

### 12. [INFO] `VALID_TABS` Knowledge Duplicated Across Files

**Location:**
- `src/app/pages/Reports.tsx:68` — `const VALID_TABS = ['study', 'quizzes', 'ai'] as const`
- `src/app/config/navigation.ts:74-76` — `tab: 'study'`, `tab: 'quizzes'`, `tab: 'ai'` on nav items
- `src/app/components/figma/SearchCommandPalette.tsx:83-105` — hardcoded `?tab=study`, `?tab=quizzes`, `?tab=ai`

The list of valid report tabs is defined implicitly in three separate files. Adding a fourth tab (e.g., "Performance") would require updating all three locations. There is no single source of truth.

**Recommendation:** Export `VALID_TABS` from a shared module (e.g., `navigation.ts` or a new `reports-config.ts`) and derive the navigation items and command palette entries from it.

---

## Summary

Epic 27 is a straightforward UI consolidation epic that was executed cleanly. The code is well-structured, follows existing patterns, and has reasonable test coverage. However:

- **1 HIGH finding** (AC contradiction) should be resolved by updating the story's AC5 text.
- **4 MEDIUM findings** represent real gaps: duplicate test IDs, missing mobile E2E tests, missing unit tests for URL-aware tabs, and the query param stripping issue.
- **5 LOW findings** are minor but worth tracking for future cleanup.

The epic's scope is appropriate for what it achieves. The main criticism is that E27-S02 (legacy redirects) is arguably unnecessary scope, and the Quiz Completion Rate card remaining on the Study tab undermines the "consolidation" promise of the epic name.

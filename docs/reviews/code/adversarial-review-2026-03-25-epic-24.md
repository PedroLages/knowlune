# Adversarial Review: Epic 24 — Course Import Wizard & Editing

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (adversarial)
**Epic:** E24 — Course Import Wizard & Editing (6 stories, all merged to main)
**Verdict:** 14 findings (3 HIGH, 6 MEDIUM, 5 LOW)

---

## Executive Summary

Epic 24 delivers a functional multi-step import wizard with AI metadata suggestions, post-import editing, and video reordering. The scan/persist refactor (S01) was a solid foundation. However, the epic suffers from a systematic testing blind spot (zero E2E coverage), a monolithic component growing without state management discipline, and several UX gaps that suggest the wizard was designed for the happy path and not for real-world use.

---

## Findings

### HIGH — Issues that will cause real user pain or accumulate costly debt

**H1. Zero E2E test coverage across the entire epic**

All 6 stories have `e2e-tests-skipped` in their review gates. The justification is "File System Access API cannot be tested in Playwright." This is technically true for the `showDirectoryPicker()` call, but it is a cop-out for everything else.

The wizard has 5+ interactive states (folder selection, name editing, tag management, image selection, confirmation, AI loading, error states). The edit dialog has tabs, form validation, tag autocomplete, and drag-and-drop. None of this is tested at the integration level in a browser.

**What could be tested with mocked File System API:**
- Wizard step transitions and back-navigation
- Tag add/remove/duplicate behavior in a real browser
- Image grid selection and deselection
- Edit dialog form validation, save/cancel flows
- Video reorder tab switch and persistence
- Mobile responsiveness of the 5-step wizard in a real viewport

The unit tests mock everything (Radix Dialog, DndContext, useAISuggestions, courseImport module). They verify that mocks were called correctly, not that the actual UI works. A single Playwright spec with a mocked `scanCourseFolder` would catch CSS regressions, focus trap issues, scroll behavior, and touch target problems that unit tests structurally cannot find.

**Impact:** Any CSS regression, Radix Dialog version bump, or Tailwind v4 class change will silently break the wizard with no test to catch it. This is the most feature-rich untested surface in the codebase.

---

**H2. ImportWizardDialog is a 657-line monolith with 14 useState hooks**

The original E24-S02 wizard had 2 steps and ~200 lines. By S04, it grew to 5 conceptual sections (folder, details, tags, images, confirmation) all managed by 14 `useState` calls in a single component. The `resetWizard` function must manually reset 12 state variables, and `handleRescan` duplicates most of that logic (lines 210-222 vs 57-71).

This is a textbook case for `useReducer` or extracting a `useImportWizard()` custom hook. The current approach:
- Makes it easy to forget a state variable in reset (the `handleRescan` function already duplicates `resetWizard` almost verbatim)
- Creates implicit coupling between AI suggestion effects and form state
- Prevents testing wizard logic without rendering the full component

No other component in the codebase has this many `useState` calls. This was introduced incrementally across 3 stories (S02, S03, S04) without anyone stepping back to refactor the state management.

**Impact:** Next feature touching the wizard (e.g., progress bar, category selection, subfolder support) will make this worse. The complexity ratchet only goes up.

---

**H3. Duplicate detection relies solely on folder name, not content**

`scanCourseFolder()` (line 113-118) checks for duplicates by matching `dirHandle.name` against existing course names. This means:
- Renaming a folder and re-importing creates a duplicate with different metadata
- Two different courses in folders with the same name (e.g., both named "Module 1") will block the second import
- If the user renames the course during import (the wizard allows this), but later re-imports the same folder, no duplicate is detected because the persisted name was overridden

The check should use the directory handle identity or a content hash, not the folder name. At minimum, the duplicate error message should explain that it is matching on folder name and offer a workaround (e.g., "rename the folder or remove the existing import").

**Impact:** Users who organize courses in identically-named subfolders (common in educational content) will be blocked without understanding why.

---

### MEDIUM — Design gaps that reduce quality or create future risk

**M1. Design review skipped for 5 of 6 stories**

Only E24-S02 received a design review. The remaining 5 stories (including S03 which added 3 new wizard sections, S05 which added a tabbed edit dialog, and S06 which added drag-and-drop) all have `design-review-skipped`. The justifications vary ("no UI changes" for S01, "dialog tested via unit tests" for S05/S06).

S03 added tag input, image grid, and confirmation summary -- three distinct UI sections that were never reviewed for:
- Touch target compliance (44x44px minimum)
- Mobile layout (the image grid uses `grid-cols-4` with no responsive breakpoint)
- Color contrast of AI suggestion badges on brand-soft backgrounds
- Keyboard navigation flow through the multi-section wizard

S06 added a drag-and-drop list that was never visually reviewed in a browser. The DnD overlay styling, drag handle affordance, and mobile touch behavior were all assumed correct from unit test output.

**Impact:** UI regressions and accessibility gaps accumulate silently when design reviews are treated as optional for "dialog-only" stories.

---

**M2. Image grid has no responsive breakpoint and is unusable on mobile**

`ImportWizardDialog.tsx` line 519: `className="grid grid-cols-4 gap-2"`. This is a fixed 4-column grid with no responsive adaptation. On a 320px-wide mobile viewport (inside a `sm:max-w-lg` dialog), each image thumbnail would be approximately 60px wide -- below the 44x44px touch target threshold once you account for the 2px gap and border.

The dialog is `sm:max-w-lg` (max-width 32rem on small screens), but the image grid never adapts. Compare with the tag input section which works at any width because it uses `flex-wrap`.

**Impact:** Cover image selection is impractical on mobile devices. Tapping the wrong image is likely, and the "selected" checkmark overlay is tiny.

---

**M3. Tag management logic is duplicated between ImportWizardDialog and EditCourseDialog**

Both components implement nearly identical tag management:
- `handleAddTag()` with trim/lowercase/deduplicate (lines 224-230 in wizard, 84-90 in edit dialog)
- `handleTagKeyDown()` with Enter/Backspace (lines 232-242 in wizard, 92-100 in edit dialog)
- `handleRemoveTag()` (lines 244-246 in wizard, 80-82 in edit dialog)
- Tag input with `onBlur={handleAddTag}` pattern

The edit dialog additionally supports comma-to-add (line 93: `e.key === ','`) and has tag autocomplete suggestions. The wizard does not have either feature, despite both being useful during import.

This duplication means:
- Bug fixes in one component may not be applied to the other
- Feature parity diverges silently (comma-add in edit but not wizard)
- A `useTagInput()` hook or `<TagInput>` component would eliminate both problems

**Impact:** Feature inconsistency between import and edit flows confuses users. Tag management debt grows with each enhancement.

---

**M4. No input validation limits in ImportWizardDialog (unlike EditCourseDialog)**

`EditCourseDialog` enforces `maxLength` on all inputs: name (120), description (500), category (60), tags (40). `ImportWizardDialog` has zero `maxLength` attributes on any input. A user could paste a 10,000-character course name during import.

The NFR report (testarch-nfr-2026-03-25-epic-24.md) flagged this as a "minor concern." It is more than minor -- it creates a data inconsistency where imported courses can have unbounded field lengths that the edit dialog then cannot display properly (the edit dialog will truncate at save time via `maxLength`, but the displayed value will be the full-length original).

**Impact:** Data quality gap between import and edit paths. Inconsistent behavior confuses users who import long names then edit them.

---

**M5. AI suggestions race condition: tags applied after user starts typing**

The `useEffect` that auto-applies AI tags (lines 74-84) checks `tags.length === 0` before applying. But there is a timing gap: if the user starts typing a tag before AI responds (Ollama can take 3-10 seconds), and then deletes it (returning to `tags.length === 0`), the AI suggestions will overwrite the empty state even though the user intentionally cleared their tags.

The `aiTagsApplied` flag prevents re-application after the first apply, but does not cover the scenario where:
1. AI is loading
2. User adds tag "react"
3. User removes tag "react" (tags.length becomes 0 again)
4. AI responds with ["python", "ml"]
5. `aiTagsApplied` is still `false` because the effect never ran successfully
6. AI tags get applied against the user's intent

**Impact:** Surprising tag replacement after user interaction. The user cleared their tags but gets AI suggestions injected.

---

**M6. Code review reports missing for 2 stories (S01, S05)**

The `docs/reviews/code/` directory contains review reports for E24-S02, S03, S04, and S06, but not for S01 or S05. The story files claim `code-review` passed in `review_gates_passed`, but no corresponding report artifact exists.

Either the reviews were run but not saved, or the gate was manually marked as passed. This breaks the traceability chain that the review system is designed to enforce.

**Impact:** No audit trail for the scan/persist refactor (the most architecturally significant story) or the edit dialog (which introduced optimistic rollback with `structuredClone`).

---

### LOW — Nits and minor inconsistencies

**L1. WizardStep type says 2 steps but the wizard has 5 sections**

`type WizardStep = 'select' | 'details'` (line 31) defines only 2 steps, but the "details" step contains 5 distinct sections (name, description, tags, cover image, confirmation) all rendered in a single scrollable view. The step indicator shows "Step 1 of 2" / "Step 2 of 2".

This was initially correct for E24-S02 (2 steps: select folder, edit name). When S03 added 3 more sections, they were crammed into the existing "details" step rather than creating proper wizard steps. The story files reference "Step 3", "Step 4", "Step 5" in their acceptance criteria, but the UI collapses these into a single scrollable page.

**Impact:** The mental model in the story files does not match the actual UI. The scroll-to-see-more pattern is less discoverable than distinct steps with forward/back navigation.

---

**L2. `handleRescan` duplicates `resetWizard` instead of calling it**

Lines 210-222 (`handleRescan`) manually reset 10 state variables. Lines 57-71 (`resetWizard`) reset 12 state variables. The only difference is that `resetWizard` also resets `isScanning` and `isPersisting`, which `handleRescan` does not need to reset. Rather than duplicating, `handleRescan` should call `resetWizard()` directly (since resetting scanning/persisting flags to false when they are already false is harmless).

**Impact:** If a new state variable is added, it must be remembered in both locations. This already happened -- `handleRescan` was added in S03 and manually kept in sync rather than delegating.

---

**L3. Category field is a free-text input with no suggestions**

`EditCourseDialog` has a `Category` field (line 189-196) that is a plain `<Input>` with `placeholder="e.g. Programming, Design"`. There is no autocomplete, no suggestions from existing categories, and no standardized category list. Compare with the `Tags` field which has autocomplete suggestions from `allTags`.

This means every user will type categories differently ("Programming" vs "programming" vs "Code" vs "Development"), creating data quality issues for any future filtering or grouping feature.

**Impact:** Categories will be inconsistent across courses. When a category filter is eventually added, it will surface this inconsistency.

---

**L4. `persistWithRetry` has no jitter and uses fixed exponential backoff**

The retry utility (lines 1-19 of `persistWithRetry.ts`) uses `Math.min(1000 * Math.pow(2, attempt), 8000)` with no random jitter. For IndexedDB writes this is low-risk (single-user, no thundering herd), but it is a pattern that will be cargo-culted to server-side API calls where jitter matters.

**Impact:** Negligible for current usage. Noted for pattern hygiene.

---

**L5. `burn_in_validated: false` on all 6 stories**

No story in Epic 24 ran burn-in testing despite multiple asynchronous patterns (AI suggestions, image preview loading, drag-and-drop persistence, optimistic rollback). The story workflow suggests burn-in when async patterns are present, but none were flagged.

**Impact:** Flaky test risk for the async patterns. The `act(...)` warnings in EditCourseDialog.test.tsx (noted in the NFR report) suggest this is already manifesting.

---

## Missing Requirements / Scope Gaps

1. **No progress indication for large imports.** The wizard shows "Scanning..." but does not display the progress bar that exists in the store (`importProgress`). A folder with 200 videos will show a spinner with no feedback for potentially 30+ seconds.

2. **No subfolder handling strategy.** `scanDirectory` recursively scans all subfolders, but the flat video list loses folder structure. A course with `week1/`, `week2/` subfolders will show all videos in a flat list with no grouping. The `path` field is stored but never surfaced in the UI.

3. **No cover image upload.** The wizard only offers images found in the scanned folder. If no images exist, "A default cover will be used." But there is no way to upload a custom cover image either during import or post-import editing.

4. **No undo for import.** After clicking "Import Course," the only way to undo is to find the course in the list and delete it. There is no confirmation dialog and no undo toast.

---

## Summary Table

| # | Severity | Finding | Files |
|---|----------|---------|-------|
| H1 | HIGH | Zero E2E test coverage across entire epic | All E24 stories |
| H2 | HIGH | 657-line component with 14 useState hooks | `ImportWizardDialog.tsx` |
| H3 | HIGH | Duplicate detection by folder name only | `courseImport.ts:113-118` |
| M1 | MEDIUM | Design review skipped for 5/6 stories | All except E24-S02 |
| M2 | MEDIUM | Image grid not responsive (fixed 4-column) | `ImportWizardDialog.tsx:519` |
| M3 | MEDIUM | Tag management duplicated between wizard and edit | Both dialog components |
| M4 | MEDIUM | No maxLength on wizard inputs (edit dialog has them) | `ImportWizardDialog.tsx` |
| M5 | MEDIUM | AI tags race condition after user clears tags | `ImportWizardDialog.tsx:74-84` |
| M6 | MEDIUM | Code review reports missing for S01 and S05 | `docs/reviews/code/` |
| L1 | LOW | WizardStep type says 2 steps, UI has 5 sections | `ImportWizardDialog.tsx:31` |
| L2 | LOW | handleRescan duplicates resetWizard logic | `ImportWizardDialog.tsx:210-222` |
| L3 | LOW | Category field has no autocomplete/suggestions | `EditCourseDialog.tsx:189-196` |
| L4 | LOW | persistWithRetry lacks jitter | `persistWithRetry.ts` |
| L5 | LOW | burn_in_validated: false on all 6 stories | All E24 story files |

---

## Recommendations

1. **Write one comprehensive E2E spec** that mocks `scanCourseFolder` at the module level and exercises the wizard flow, edit dialog, and video reorder in a real browser. This single spec would cover H1, partially M1, and M2.
2. **Extract `useImportWizard()` hook** from `ImportWizardDialog` to centralize state management, eliminate reset duplication, and enable logic-only testing (H2, L2).
3. **Extract `<TagInput>` component** shared between wizard and edit dialog (M3, M4).
4. **Add responsive breakpoints** to the image grid: `grid-cols-2 sm:grid-cols-4` (M2).
5. **Improve duplicate detection** to compare directory handle identity or offer an override option (H3).
6. **Backfill missing code review reports** for S01 and S05 (M6).

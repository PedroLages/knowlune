---
story_id: E11-S04
story_name: "Data Export"
status: in-progress
started: 2026-03-15
completed:
reviewed: true
review_started: 2026-03-15
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 11.4: Data Export

## Story

As a learner,
I want to export all my learning data in JSON, CSV, and Markdown formats and export achievements as Open Badges,
So that I own my data, can use it in other tools, and can share verifiable credentials.

## Acceptance Criteria

**AC1:** Given a learner initiates a full data export in JSON format
When the export completes
Then the exported JSON file includes all sessions, progress, streaks, notes, and achievements
And the file contains a schema version identifier at the root level
And the export completes within 30 seconds regardless of data volume

**AC2:** Given a learner initiates a full data export in CSV format
When the export completes
Then separate CSV files are generated for sessions, progress, and streaks
And each file includes column headers and all associated records
And the export completes within 30 seconds

**AC3:** Given a learner initiates a notes export in Markdown format
When the export completes
Then each note is exported as an individual Markdown file with YAML frontmatter containing title, course, topic, tags, created date, and last reviewed date
And the export completes within 30 seconds

**AC4:** Given the system logs a learning activity
When the activity is recorded
Then the log entry follows an Actor plus Verb plus Object structure compatible with xAPI statement format
And the actor identifies the learner, the verb describes the action, and the object identifies the learning resource

**AC5:** Given a learner has earned achievements
When they export achievements as Open Badges
Then each achievement is exported as an Open Badges v3.0 compliant JSON file
And the badge contains issuer information, criteria, and evidence fields

**AC6:** Given a learner has previously exported their data
When they re-import the exported JSON data
Then the system restores the data with 95% or greater semantic fidelity
And any schema version differences are handled through non-destructive automatic migrations

**AC7:** Given a learner initiates an export with a large dataset
When the export process is running
Then a progress indicator shows the current export status
And the learner can continue using the application while the export runs in the background

**AC8:** Given the export fails due to insufficient disk space or a browser write error
When the error is detected
Then a toast notification explains the failure and suggests freeing disk space
And the partially exported data is cleaned up

## Tasks / Subtasks

- [ ] Task 1: Create export service with JSON serializer (AC: 1)
  - [ ] 1.1 Define export schema with version identifier
  - [ ] 1.2 Serialize sessions, progress, streaks, notes, achievements
  - [ ] 1.3 Performance: complete within 30s for large datasets
- [ ] Task 2: Create CSV export for sessions, progress, streaks (AC: 2)
  - [ ] 2.1 Generate separate CSV files with headers
  - [ ] 2.2 Bundle into zip download
- [ ] Task 3: Create Markdown notes export (AC: 3)
  - [ ] 3.1 Export each note as individual .md file with YAML frontmatter
  - [ ] 3.2 Bundle into zip download
- [ ] Task 4: Implement xAPI-compatible activity logging (AC: 4)
  - [ ] 4.1 Define Actor/Verb/Object statement structure
  - [ ] 4.2 Integrate with existing session logging
- [ ] Task 5: Open Badges v3.0 export (AC: 5)
  - [ ] 5.1 Generate compliant badge JSON with issuer, criteria, evidence
- [ ] Task 6: JSON re-import with schema migration (AC: 6)
  - [ ] 6.1 Parse and validate imported JSON
  - [ ] 6.2 Handle schema version differences with migrations
  - [ ] 6.3 Verify 95%+ semantic fidelity
- [ ] Task 7: Export UI with progress indicator (AC: 7)
  - [ ] 7.1 Add export section to Settings page
  - [ ] 7.2 Background export with progress bar
  - [ ] 7.3 Allow continued app usage during export
- [ ] Task 8: Error handling and cleanup (AC: 8)
  - [ ] 8.1 Detect disk space / browser write errors
  - [ ] 8.2 Toast notification with actionable message
  - [ ] 8.3 Clean up partial exports

**Dependencies:** Epic 3 (notes data), Epic 4 (session and progress data), Epic 5 (streak data), Epic 6 (challenge/achievement data)

**Complexity:** Large (6-8 hours)

## Design Guidance

### Layout Strategy

**Extend the existing Data Management card** in Settings.tsx (lines 466-597) rather than creating a new section. The current card already has "Export, import, or reset your learning data" and a simple JSON export button. This story upgrades that card with multi-format export options.

**Card structure (inside existing Data Management card):**

```
┌─── Data Management ─── (existing CardHeader) ──────────────────┐
│                                                                  │
│  ┌── Export Your Data ────────────────────────────────────────┐  │
│  │  📦 Full Data Export                                       │  │
│  │  "All sessions, progress, streaks, notes, achievements"    │  │
│  │  [JSON]  [CSV]                              [Export ▾]     │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  📝 Notes Export                                           │  │
│  │  "Individual Markdown files with YAML frontmatter"         │  │
│  │                                               [Export]     │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │  🏅 Achievements Export                                    │  │
│  │  "Open Badges v3.0 compliant credentials"                  │  │
│  │                                               [Export]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Progress ── (visible during export) ─────────────────────┐  │
│  │  Exporting... sessions (2/5 tables)                        │  │
│  │  ████████████░░░░░░░░░░░  40%                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ─────────────────── separator ────────────────────             │
│                                                                  │
│  ┌── Import Data ─────────────────────────────────────────────┐  │
│  │  (existing import card, enhanced for JSON re-import)       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ─────────────────── separator ────────────────────             │
│                                                                  │
│  ┌── Danger Zone ─────────────────────────────────────────────┐  │
│  │  (existing reset card — unchanged)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Patterns (follow existing Settings.tsx conventions)

- **Export row cards**: Use the same `rounded-xl border border-border bg-surface-elevated p-4` pattern as existing Export/Import cards (lines 486-538)
- **Icons**: `Download` for exports, `FileJson` for JSON, `FileSpreadsheet` for CSV, `FileText` for Markdown, `Award` or `Medal` for badges (all from lucide-react)
- **Buttons**: `variant="outline" size="sm"` for individual export actions, matching existing Export button style
- **Progress bar**: Reuse existing `<Progress>` component (already imported in Settings.tsx line 21) with the same `h-1.5 bg-brand-soft` styling used for avatar upload progress
- **Toast notifications**: Use existing `toastSuccess`/`toastError` helpers from `@/lib/toastHelpers` (already imported)

### Design Token Usage

| Element | Token | Notes |
|---------|-------|-------|
| Export section bg | `bg-surface-elevated` | Match existing card pattern |
| Icon containers | `bg-success-soft`, `bg-brand-soft` | Match existing icon badge pattern |
| Progress bar | `bg-brand-soft` (track), brand fill | Reuse avatar upload pattern |
| Error states | `text-destructive`, `bg-destructive/5` | Match existing error pattern |
| Format labels | `text-muted-foreground` | Subtle format indicators |

### Responsive Strategy

- **Mobile (<640px)**: Stack export cards vertically, full-width buttons
- **Tablet (640-1024px)**: Same layout (Settings is max-w-2xl, already constrained)
- **Desktop (1024px+)**: Same layout within `max-w-2xl` container

No special responsive handling needed — the existing Settings page card layout handles this with `max-w-2xl` constraint.

### Accessibility Requirements

- Export buttons: Clear accessible names (`aria-label="Export all data as JSON"`)
- Progress indicator: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label="Export progress"`
- Toast notifications: Already handled by Sonner's built-in ARIA
- Format selection: Use radio group or toggle group with proper labeling
- Keyboard: All interactive elements focusable, Enter/Space to activate

### Key Implementation Notes

- **data-testid="data-export-section"** on the export container (required by ATDD tests)
- **data-testid="export-progress"** on the progress indicator (required by ATDD tests)
- Existing `handleExport()` (line 84) and `handleImport()` (line 96) should be replaced/extended with new multi-format export service
- Background export: Use Web Worker or async generator to avoid blocking UI thread
- File download: Use `showSaveFilePicker()` (File System Access API) with fallback to `URL.createObjectURL()` + anchor click for browsers without FSAA support

## Implementation Plan

See [plan](plans/e11-s04-data-export.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

**Testing Requirements:** Unit tests for JSON/CSV/Markdown serialization and schema versioning, Integration tests for re-import fidelity, E2E for export workflow, progress indicator, and Open Badges output

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

Report: `docs/reviews/design/design-review-2026-03-15-e11-s04.md`

- **HIGH**: All export buttons 32px tall — below 44px touch-target minimum. Fix: add `min-h-[44px]`.
- **HIGH**: Import button missing `aria-label`.
- **MEDIUM**: Export progress container has no `aria-live` region.
- **MEDIUM**: Heading hierarchy — three H3 sub-sections inside H3 card title.
- **MEDIUM**: JSON+CSV dual-button row overflows on 375px mobile.

## Code Review Feedback

Report: `docs/reviews/code/code-review-2026-03-15-e11-s04.md`

- **HIGH**: localStorage restoration outside Dexie transaction (split-brain on failure).
- **HIGH**: Schema migration silently skips versions without registered functions.
- **HIGH**: Non-deterministic `new Date().toISOString()` in export.
- **HIGH**: `w-4 h-4` instead of `size-4` shorthand (19 instances).
- **MEDIUM**: `getLocalStorageData()` exports ALL keys without filtering.
- **MEDIUM**: `streak-milestones` parsed without type validation.
- **MEDIUM**: Early returns use error toast for "no data" (not a failure).
- **MEDIUM**: `downloadBlob` synchronously revokes URL after click.
- **MEDIUM**: `createActor()` reads localStorage per statement in bulk export.

## Web Design Guidelines Review

Report: `docs/reviews/design/web-design-guidelines-2026-03-15-e11-s04.md`

- **MEDIUM**: Missing `aria-label` on Import button (also flagged by design review).
- **MEDIUM**: Hidden file input lacks accessible labeling.
- **MEDIUM**: Export progress missing `role="status"` / `aria-live="polite"`.
- Design token compliance excellent (zero hardcoded colors).

## Challenges and Lessons Learned

### ATDD tests required data seeding for export-dependent paths

The ATDD tests for AC3 (Markdown notes) and AC5 (Open Badges) were written RED before implementation but didn't account for the empty-data guard paths added during implementation. Both `handleExportMarkdown()` and `handleExportBadges()` return early with an error toast when no data exists — so the tests timed out waiting for a download that never triggered. Fixed by seeding a note and a completed challenge via `seedIndexedDBStore()` before each export test.

### Error handling mock targeted wrong API

The AC8 error test mocked `showSaveFilePicker` (File System Access API) but the implementation chose the simpler blob + anchor click pattern (`URL.createObjectURL` + `a.click()`). The mock had no effect, so the export succeeded instead of failing. Fixed by mocking `URL.createObjectURL` to throw a `QuotaExceededError`, which propagates through the try-catch in the handler and surfaces the error toast.

### Blob + anchor download pattern is Playwright-friendly

The `downloadBlob()` utility using `URL.createObjectURL` + programmatic anchor click works reliably with Playwright's `page.waitForEvent('download')`. Key pattern: register the download listener BEFORE clicking the export button (`const downloadPromise = page.waitForEvent('download')` then `await btn.click()` then `await downloadPromise`).

### Multi-format export benefits from shared download utilities

Centralizing download logic in `fileDownload.ts` (`downloadJson`, `downloadText`, `downloadZip`) kept the Settings.tsx handlers clean and made error handling consistent across JSON, CSV, Markdown, and Open Badges exports. JSZip's `generateAsync()` integrates cleanly with the async handler pattern.

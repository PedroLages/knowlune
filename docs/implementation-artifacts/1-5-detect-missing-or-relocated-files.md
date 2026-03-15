---
story_id: E01-S05
story_name: "Detect Missing or Relocated Files"
status: done
started: 2026-03-15
completed: 2026-03-15
reviewed: true
review_started: 2026-03-15
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]
burn_in_validated: false
---

# Story 1.5: Detect Missing or Relocated Files

## Story

As a learner,
I want the system to alert me when course files have been moved or deleted from my file system,
So that I know which content is unavailable and can take action.

## Acceptance Criteria

**Given** a course has been previously imported
**When** the user opens the course or the system loads course data
**Then** the system verifies each FileSystemHandle is still accessible
**And** verification completes without blocking the UI

**Given** a file's FileSystemHandle returns a permission error or file-not-found
**When** the verification completes
**Then** the affected content item displays a "File not found" badge
**And** a toast notification identifies the affected file within 2 seconds (NFR11)

**Given** some files in a course are missing but others are available
**When** the user views the course structure
**Then** available files are fully functional
**And** missing files show the "file not found" badge but remain in the structure
**And** the user can still navigate and access the available content

**Given** the user re-grants file permission or restores the file
**When** the system re-verifies the handle (on next course load)
**Then** the "file not found" badge is removed
**And** the content becomes accessible again

## Tasks / Subtasks

- [ ] Task 1: Add file accessibility status to Dexie schema (AC: 1, 2)
  - [ ] 1.1 Add `fileStatus` field to content items (e.g., 'available' | 'missing' | 'permission-denied')
  - [ ] 1.2 Create schema migration
- [ ] Task 2: Implement FileSystemHandle verification logic (AC: 1, 4)
  - [ ] 2.1 Create verification utility that checks handle accessibility
  - [ ] 2.2 Handle permission errors vs file-not-found distinctly
  - [ ] 2.3 Implement non-blocking verification (async, doesn't block UI)
- [ ] Task 3: Trigger verification on course load (AC: 1)
  - [ ] 3.1 Hook verification into course load flow
  - [ ] 3.2 Update content item status in Dexie after verification
- [ ] Task 4: Display "File not found" badge on affected content (AC: 2, 3)
  - [ ] 4.1 Add badge component to course structure items
  - [ ] 4.2 Show toast notification for missing files
  - [ ] 4.3 Ensure available files remain fully functional
- [ ] Task 5: Handle file recovery (AC: 4)
  - [ ] 5.1 Re-verify on next course load
  - [ ] 5.2 Remove badge and restore access when file is found again

## Design Guidance

### File Status Badge

Use the existing `Badge` component (`src/app/components/ui/badge.tsx`) with the `destructive` variant for "File not found" state. This provides automatic light/dark mode support via `--destructive` / `--destructive-foreground` tokens.

```tsx
<Badge variant="destructive" data-testid={`file-not-found-badge-${item.id}`}>
  <AlertTriangle className="size-3" />
  File not found
</Badge>
```

For a "Permission denied" state (file exists but handle needs re-authorization), use a custom warning variant:

```tsx
<Badge className="bg-warning text-warning-foreground" data-testid={`file-permission-badge-${item.id}`}>
  <ShieldAlert className="size-3" />
  Permission needed
</Badge>
```

### Content Item States

Each content item in the course list (`course-content-list`) has three possible states:

| State | Visual | Interaction |
|-------|--------|-------------|
| **Available** | Current styling (clickable link, brand icon) | Navigates to lesson player |
| **Missing** | Reduced opacity (0.5), destructive badge, muted icon color | Non-clickable (render as `div` not `Link`), cursor-not-allowed |
| **Permission denied** | Reduced opacity (0.65), warning badge | Clickable — triggers re-permission prompt |

### Toast Notifications

Use Sonner toast (already configured) with `toast.warning()` for file status issues:

```tsx
toast.warning(`${missingCount} file(s) not found`, {
  description: missingFiles.map(f => f.filename).join(', '),
})
```

- Show **one aggregated toast** per course load (not per file) to avoid toast spam
- Toast appears within 2 seconds of verification completing (NFR11)

### Layout Impact

No layout changes needed. The badge renders inline within the existing content item row, positioned after the filename and before the duration/page count metadata:

```
[VideoIcon] lesson-1.mp4 ............... [File not found] 5:30
```

### Responsive Considerations

- Badge text truncates on mobile — keep label short ("File not found", not "This file could not be located")
- Touch targets remain ≥44x44px (the row itself is the target, not the badge)
- Badge wraps below filename on very narrow viewports (flex-wrap)

### Accessibility

- Badge uses `role="status"` for screen readers
- Missing items have `aria-disabled="true"` on the row
- Toast is announced via Sonner's built-in ARIA live region
- Color alone doesn't convey status — the badge text + icon provide redundant cues

### Test IDs

| Element | Test ID Pattern |
|---------|----------------|
| Content item row | `course-content-item-{video|pdf}-{id}` (extend existing) |
| File status indicator | `file-status-{id}` |
| File not found badge | `file-not-found-badge-{id}` |
| Permission badge | `file-permission-badge-{id}` |

## Implementation Plan

See [plan](plans/e01-s05-detect-missing-relocated-files.md) for implementation approach.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

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

Reviewed 2026-03-15. Report: `docs/reviews/design/design-review-2026-03-15-e01-s05.md`

**Verdict: PASS with warnings.** Badge design, accessibility, responsive behavior, and token usage all correct. Two HIGH findings: (1) double toast on course load due to separate video/PDF useEffect runs, (2) permission-denied not handled in PDF rendering path.

## Code Review Feedback

Reviewed 2026-03-15. Report: `docs/reviews/code/code-review-2026-03-15-e01-s05.md`

**Verdict: PASS with warnings.** 0 blockers, 4 high, 3 medium, 3 nits. Key findings: (1) Dexie queries missing .catch(), (2) className string interpolation instead of cn(), (3) Promise.allSettled 'unknown' key bug, (4) toast only reports missing files, not permission-denied.

## Web Design Guidelines Review

Reviewed 2026-03-15. Report: `docs/reviews/design/web-design-guidelines-2026-03-15-e01-s05.md`

**Verdict: PASS with recommendations.** Accessibility foundations solid. Key findings: (1) no visual indication during 'checking' state, (2) permission-denied items should be clickable for re-auth per design spec, (3) missing flex-wrap on content rows for narrow viewports.

## Challenges and Lessons Learned

- **Ephemeral vs persistent file status**: Decided against Dexie schema migration for `fileStatus` field. File accessibility is inherently transient (files can be moved between sessions), so caching status in the DB creates stale data risk. Verifying in-memory on each course load is simpler and more reliable.
- **Existing handle verification pattern**: The `useVideoFromHandle` hook already implements `queryPermission` → `getFile` with proper error handling. Extracted this into a reusable utility rather than duplicating logic.
- **Test strategy with browser-only APIs**: `FileSystemHandle` cannot be mocked in Playwright. Seeded test data without handles naturally triggers the "missing" state, making tests straightforward without complex mocking.
- **IndexedDB is shared across Chromium browser contexts**: With `fullyParallel: true`, tests that seed IndexedDB corrupt each other's data. Fixed with `test.describe.configure({ mode: 'serial' })`. Any spec that seeds IDB should be serialized.
- **Zustand hydration on direct URL navigation**: The detail page initially showed "Course not found" because the Zustand store was empty on first render before `loadImportedCourses()` resolved. Required adding a loading state to avoid flash-of-missing-content.
- **Two review rounds needed**: First review found 8 issues (0 blockers, 2 HIGH). Second review passed clean after fixes. The review agent swarm (design + code + testing) consistently catches real issues — worth running early.

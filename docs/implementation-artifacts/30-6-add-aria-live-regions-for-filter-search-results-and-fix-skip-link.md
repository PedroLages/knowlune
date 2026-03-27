---
story_id: E30-S06
story_name: "Add aria-live Regions for Filter/Search Result Changes and Fix Skip Link Focus Ring"
status: ready-for-dev
started: 2026-03-27
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 30.6: Add aria-live Regions for Filter/Search Result Changes and Fix Skip Link Focus Ring

## Story

As a screen reader user,
I want to be informed when filter or search actions change the displayed results,
So that I know the content has updated without having to re-scan the page.

## Acceptance Criteria

**Given** the Session History page with date filters
**When** the user changes a filter and the result count changes
**Then** a visually-hidden `aria-live="polite"` region announces "Showing X results"

**Given** the Learning Paths page with search/filter
**When** results are filtered
**Then** the result count is announced via `aria-live`

**Given** the Reports page
**When** filters change the displayed data
**Then** the updated count is announced via `aria-live`

**Given** the skip-to-content link (all pages)
**When** the link receives focus
**Then** a visible focus ring is displayed (fix `outlineWidth: 0px` suppression)

## Tasks / Subtasks

- [ ] Task 1: Create reusable aria-live announcer component
  - [ ] 1.1 Create a `<LiveRegion>` component (or use inline pattern) for announcing dynamic content changes
  - [ ] 1.2 Pattern: `<span role="status" aria-live="polite" className="sr-only">{message}</span>`
  - [ ] 1.3 Ensure the region is present in DOM before content updates (aria-live only announces changes to existing regions)
- [ ] Task 2: Add aria-live to Session History page (AC: 1)
  - [ ] 2.1 Locate the filtered results area in Session History page component
  - [ ] 2.2 Add the live region that updates when filter results change
  - [ ] 2.3 Compose message: "Showing {count} session{count !== 1 ? 's' : ''}"
  - [ ] 2.4 Debounce announcements if filters trigger rapid updates (300ms delay)
- [ ] Task 3: Add aria-live to Learning Paths page (AC: 2)
  - [ ] 3.1 Locate the filtered/searched results area in Learning Paths page
  - [ ] 3.2 Add live region with result count announcement
  - [ ] 3.3 Compose message: "Showing {count} learning path{count !== 1 ? 's' : ''}"
- [ ] Task 4: Add aria-live to Reports page (AC: 3)
  - [ ] 4.1 Locate the filtered data display in Reports page
  - [ ] 4.2 Add live region with appropriate count/summary announcement
  - [ ] 4.3 Compose message appropriate to the report type being filtered
- [ ] Task 5: Fix skip-to-content link focus ring (AC: 4)
  - [ ] 5.1 Locate the skip-to-content link (likely in `Layout.tsx` or `App.tsx`)
  - [ ] 5.2 Find and remove `outlineWidth: 0px` or `outline: none` suppression
  - [ ] 5.3 Add visible focus ring: `focus:ring-2 focus:ring-brand focus:ring-offset-2` or use browser default
  - [ ] 5.4 Verify the skip link appears on Tab press from page top and moves focus to `<main>` content
- [ ] Task 6: Verify aria-live region behavior
  - [ ] 6.1 Test that announcements only fire on content change (not on initial page load)
  - [ ] 6.2 Test that rapid filter changes don't cause announcement spam (debounce)
  - [ ] 6.3 Test that "0 results" is properly announced

## Implementation Notes

- **WCAG Reference:** WCAG 4.1.3 (Status Messages) — status messages must be programmatically determinable without receiving focus. WCAG 2.4.7 (Focus Visible) — focus indicators must be visible.
- **Audit findings:** Medium-priority findings for aria-live on Session History, Learning Paths, Reports; medium finding for skip link focus ring suppression
- **aria-live pattern:**
  ```tsx
  // Reusable pattern — place inside the page component, near the filtered content
  const [resultCount, setResultCount] = useState(0);

  return (
    <>
      {/* Visually hidden but announced by screen readers when content changes */}
      <span role="status" aria-live="polite" className="sr-only">
        {resultCount > 0
          ? `Showing ${resultCount} result${resultCount !== 1 ? 's' : ''}`
          : 'No results found'}
      </span>

      {/* Visible filtered content */}
      <div>{filteredItems.map(...)}</div>
    </>
  );
  ```
- **Important aria-live behavior:**
  - The live region element must exist in the DOM BEFORE content changes — don't conditionally render it
  - Use `aria-live="polite"` (waits for screen reader to finish current announcement) not `"assertive"`
  - `role="status"` implicitly sets `aria-live="polite"` but being explicit is clearer
- **Skip link fix:** The skip link likely has an inline style or CSS class suppressing the focus outline. Remove the suppression and ensure the link is styled to be visible only on focus:
  ```tsx
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-brand focus:rounded-md"
  >
    Skip to content
  </a>
  ```

## Testing Notes

- **Screen reader testing (VoiceOver):**
  - Session History: Change date filter → VoiceOver should announce "Showing X sessions" after a brief pause
  - Learning Paths: Type in search → VoiceOver should announce updated count
  - Reports: Change filter → VoiceOver should announce updated summary
  - Skip link: Press Tab on any page → skip link should appear with visible focus ring → press Enter → focus moves to main content
- **E2E assertions:**
  ```typescript
  // Verify aria-live region exists and updates
  const liveRegion = page.locator('[aria-live="polite"]');
  await expect(liveRegion).toContainText(/Showing \d+ result/);

  // Change filter and verify announcement updates
  await page.selectOption('[data-testid="date-filter"]', '7days');
  await expect(liveRegion).toContainText(/Showing \d+ session/);

  // Skip link focus ring
  await page.keyboard.press('Tab');
  const skipLink = page.getByText('Skip to content');
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toBeFocused();
  ```
- **Debounce testing:** Rapidly change filters — verify only the final count is announced, not intermediate values
- **Zero results:** Verify "No results found" is announced when filters produce empty results
- **Focus ring contrast:** Verify focus ring color meets WCAG 2.4.11 (Focus Appearance) — 3:1 contrast ratio against adjacent colors

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

- **Conditional announcements**: aria-live regions only announce when filters are active (empty string on initial load) to avoid unnecessary noise
- **polite vs assertive**: Used `aria-live="polite"` so announcements don't interrupt current screen reader output
- **Skip link contrast**: Used `ring-brand-foreground` (white) against `bg-brand` background for proper contrast on focus

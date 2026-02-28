# Design Review: E03-S04 — Tag-Based Note Organization

**Date:** 2026-02-27
**Route tested:** `/courses/:courseId/:lessonId?panel=notes`
**Viewports:** Desktop (1280x800)

## What Works Well

1. **Tag badge visual design is clean and consistent.** Badges use the project's standard Badge component with appropriate sizing and spacing. The `flex-wrap gap-1.5` layout handles multiple tags gracefully.

2. **Popover-based tag editor is well-positioned.** The TagEditor popover anchors correctly to the add-tag button and provides a focused input experience with autocomplete suggestions.

3. **Tags section integrates naturally into the NoteEditor.** The tag area below the editor textarea follows the existing content flow and doesn't disrupt the note-taking experience.

## Findings

### Blockers

- **[`TagEditor.tsx`:52] — No visible focus indicator on the add-tag button.** The circular add-tag button (`+`) has no `focus-visible` ring. Keyboard-only users cannot see which element is focused when tabbing through the tag controls. This violates WCAG 2.1 AA Success Criterion 2.4.7 (Focus Visible).

  **Fix:** Add focus-visible ring classes:
  ```tsx
  className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
  ```

- **[`TagBadgeList.tsx`:35] — No visible focus indicator on tag remove buttons.** The X remove buttons on tag badges have no focus ring. Same WCAG violation as above.

  **Fix:** Add focus-visible ring classes:
  ```tsx
  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-2 -m-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
  ```

### High Priority

- **[`TagEditor.tsx`:52] — Add-tag button touch target is 20x20px, below 44x44px WCAG minimum.** The button uses `h-5 w-5` (20px). Mobile/tablet users will struggle to tap reliably.

  **Fix:** Expand hit area with padding trick: `p-2 -m-2` keeps visual size compact but expands the touch target to ~36px. Alternatively use `min-h-[44px] min-w-[44px]`.

- **[`NoteEditor.tsx`:195] — Tag container lacks `aria-live` for screen reader announcements.** When tags are added or removed, screen readers have no notification that the tag list changed.

  **Fix:** Add `aria-live="polite"` and `aria-label="Note tags"` to the tag container div.

### Medium

- **[`NoteEditor.tsx`:267] — Preview tab shows editable tags (add/remove controls).** The same `tagSection` JSX with TagEditor and removable badges renders in both Edit and Preview tabs. Preview should be read-only for tags — showing `TagBadgeList` without `onRemove` and without `TagEditor`.

  **Fix:** Render read-only `<TagBadgeList tags={tags} />` in the preview tab (no `onRemove`, no `TagEditor`).

### Nits

- **[`TagEditor.tsx`:52]** — `h-5 w-5` should be `size-5` per Tailwind v4 convention. `h-3 w-3` on Plus icon should be `size-3`.

---
Issues found: 6 | Blockers: 2 | High: 2 | Medium: 1 | Nits: 1
